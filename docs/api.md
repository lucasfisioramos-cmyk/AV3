# API: endpoints principais

Base: `/api/v1`. Documentação interativa e atualizada automaticamente (Swagger/OpenAPI): `http://localhost:3000/docs`.
Esta página é um guia; **o contrato completo (campos, tipos, exemplos) está no Swagger**, gerado dos schemas Zod em `src/schemas`.

Autenticação: `Authorization: Bearer <token>` em tudo, exceto `/auth/login` e `/health`. Permissões por papel em [autenticacao.md](autenticacao.md).

## Formato das respostas

Sucesso (`message` e `meta` são opcionais; listas trazem `meta.total`; operações sem retorno devolvem `"data": null`):

```json
{ "data": { }, "message": "Lote criado com sucesso.", "meta": { "total": 10 } }
```

Erro (`details` só aparece em validação, 400):

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Dados da requisição inválidos.",
  "details": [{ "local": "body", "campo": "cnpj", "mensagem": "Campo obrigatório." }]
}
```

| Status | Quando |
| --- | --- |
| 400 | Payload inválido ou regra de negócio violada |
| 401 | Token ausente/inválido/expirado, ou credenciais de login inválidas |
| 403 | Papel sem permissão |
| 404 | Recurso inexistente |
| 409 | Duplicidade ou conflito de `version` |
| 5xx | Falha interna (mensagem genérica) ou banco indisponível (503) |

## Endpoints

| Método e rota | Papéis | Sucesso | Descrição |
| --- | --- | --- | --- |
| `GET /health` | público | 200 | Estado da API (`status`, `uptime`, `timestamp`) |
| `POST /auth/login` | público | 200 | `{usuario, senha}` → `{token, usuario, papel}` |
| `POST /usuarios` | ADM | 201 | Cria usuário `{usuario, senhaPlana, papel}` |
| `PUT /usuarios/:id` | ADM; demais só em si mesmos | 200 | Altera `usuario`, `senha` e/ou `papel` (ao menos um) |
| `PATCH /usuarios/me/senha` | autenticados | 200 | Troca a própria senha `{novaSenha}` |
| `DELETE /usuarios/:id` | ADM | 200 | Remove usuário (protege o último ADM) |
| `GET /organizacoes` | autenticados | 200 | Lista organizações |
| `POST /organizacoes` | ADM, OPERADOR_CADASTRO | 201 | Cria organização (valida CNPJ) |
| `GET /lotes` | autenticados | 200 | Lista lotes com organização e total de equipamentos |
| `GET /lotes/:id` | autenticados | 200 | Detalhe do lote com equipamentos |
| `POST /lotes` | ADM, GESTOR_ALMOXARIFADO | 201 | Cria lote `{organizacaoId, notaFiscal, transportadora, observacoes?}` |
| `POST /equipamentos` | ADM, OPERADOR, GESTOR | 201 | Cadastra equipamento em um lote |
| `PATCH /equipamentos/:id/movimentar` | ADM, OPERADOR, GESTOR | 200 | Muda o status de rastreamento e registra o histórico |
| `PATCH /equipamentos/:id/estado-fisico` | ADM, OPERADOR, GESTOR | 200 | Altera o estado físico (justificativa se rebaixar 2+) |
| `GET /equipamentos/rastrear/:identificador` | autenticados | 200 | Busca por id **ou** código de barras |
| `GET /relatorios/status` | ADM, GESTOR, AUDITOR | 200 | Painel geral |
| `GET /relatorios/organizacao/:id` | ADM, GESTOR, AUDITOR | 200 | Métricas de uma organização |

(`ADM` = `ADMINISTRADOR`, `OPERADOR` = `OPERADOR_CADASTRO`, `GESTOR` = `GESTOR_ALMOXARIFADO`.)

## Exemplos

```bash
# login
curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"usuario":"admin","senha":"Greencode#Dev2026"}'

# usar o token
curl -s http://localhost:3000/api/v1/lotes -H "Authorization: Bearer $TOKEN"

# movimentar um equipamento (version = a versão atual lida do equipamento)
curl -s -X PATCH http://localhost:3000/api/v1/equipamentos/$ID/movimentar \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"novoStatus":"EM_TRIAGEM","origem":"Recebimento","destino":"Triagem","responsavel":"Ana","version":1}'
```
