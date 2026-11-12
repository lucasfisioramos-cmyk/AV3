# Regras de negócio

Cada regra tem um dono no código (`src/domain/<módulo>/*.rules.ts` ou `validators/`) e um teste em `tests/`.
Violação de regra responde **400**; duplicidade ou conflito de versão responde **409**; recurso inexistente, **404**.

## Usuários e acesso

| Regra | Onde | Resposta |
| --- | --- | --- |
| Nome de usuário é único | `UsuarioRules.garantirUsuarioInedito` / `garantirNovoNomeDisponivel` | 409 |
| Senha segue a política (≥ 8, maiúscula, minúscula, número, símbolo, ≤ 72 bytes, sem o nome de usuário, não comum) | `validators/senha.ts` | 400 |
| Papel deve ser um dos quatro válidos | `validators/papel.ts` | 400 |
| Só administrador cria, remove usuários e altera nome de usuário e papel | rotas + `UsuarioRules` | 403 |
| Não administrador só edita **a si mesmo**, e apenas a senha | `UsuarioRules.autorizarEdicao` | 403 |
| Edição sem nenhum campo é inválida | `UsuarioRules.exigirAlgumaAlteracao` | 400 |
| **O sistema nunca fica sem administrador**: não é possível remover nem rebaixar o único | `UsuarioRules.protegerUltimoAdministrador` | 400 |

A proteção do último administrador roda em **transação serializável**: duas requisições simultâneas não conseguem remover os dois últimos administradores.

## Organizações

| Regra | Onde | Resposta |
| --- | --- | --- |
| CNPJ deve ter 14 dígitos, não ser sequência repetida e ter os dígitos verificadores corretos (aceita com ou sem máscara) | `validators/cnpj.ts` | 400 |
| CNPJ é gravado **só com dígitos**; o mesmo CNPJ com outra máscara é duplicado | `OrganizacaoService` | 409 |
| E-mail em formato válido | `validators/email.ts` | 400 |

## Lotes

| Regra | Onde | Resposta |
| --- | --- | --- |
| A organização do lote deve existir | `LoteService` | 404 |
| Data de entrada não pode ser futura nem anterior a **90 dias** (limite inclusivo) | `validators/data-entrada.ts`, `LoteRules.exigirDataEntradaValida` | 400 (`Regra Violada: ...`) |
| Nota fiscal não pode se repetir **na mesma organização** | `LoteRules.garantirNotaFiscalInedita` | 409 |
| Todo lote nasce `RECEBIDO` | `LoteService` | |
| O primeiro equipamento cadastrado muda o lote para `EM_TRIAGEM` (mesma transação do cadastro) | `LoteRules.deveIniciarTriagem`, `EquipamentoService` | |

Notas: (1) a API de criação **não recebe `dataEntrada`**; o lote nasce com a data atual, então a regra dos 90 dias protege o serviço (e futuras entradas retroativas), mas hoje não é alcançável por HTTP. (2) A unicidade da nota fiscal é verificada no serviço, não por constraint no banco; em corrida extrema duas criações simultâneas poderiam passar. (3) Das transições de `StatusLote`, apenas `RECEBIDO → EM_TRIAGEM` está implementada.

## Equipamentos

| Regra | Onde | Resposta |
| --- | --- | --- |
| Ano de fabricação entre 1900 e o ano atual; peso > 0 | `EquipamentoRules` | 400 |
| O lote deve existir | `EquipamentoService` | 404 |
| Cada equipamento recebe posição sequencial no lote e código de barras `GC-<4 primeiros caracteres do lote>-<3 letras do tipo>-<posição com 3 dígitos>` | `equipamento.codigo.ts` | |
| Nasce `AGUARDANDO_TRIAGEM` | `EquipamentoService` | |
| **Trava de desmonte:** só pode ir para `AGUARDANDO_DESMONTE` ou `EM_DESMONTE` quem está em `EM_TRIAGEM` | `exigirTriagemAntesDoDesmonte` | 400 |
| **Rebaixamento de estado físico:** cair 2 ou mais categorias exige justificativa não vazia | `exigirJustificativaParaRebaixamento` | 400 |
| **Concorrência otimista:** `version` enviada deve ser a atual; senão outra pessoa alterou antes | `exigirVersaoAtual` | 409 |
| Toda movimentação grava histórico (origem, destino, responsável, observação) atomicamente com a troca de status | `EquipamentoService` | |

Hierarquia do estado físico, do melhor ao pior: `NOVO`, `BOM_ESTADO`, `USADO_LEVE`, `USADO_MODERADO`, `DANIFICADO_LEVE`, `DANIFICADO_GRAVE`, `INSERVIVEL`. Melhorar o estado ou cair uma categoria não exige justificativa.

Ao receber 409 de `version`, o cliente deve reler o equipamento (`GET /equipamentos/rastrear/:identificador`) e repetir com a versão atual.

## Relatórios

Somente leitura: painel geral (total de lotes, equipamentos, peso total em kg e contagem por status) e métricas por organização. Sem transação.
