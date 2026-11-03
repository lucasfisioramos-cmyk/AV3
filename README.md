# ♻️ Greencode - Sistema de Logística Reversa (API RESTful)

> **API RESTful robusta desenvolvida para a gestão e rastreabilidade de ativos eletrônicos em processos de logística reversa, triagem e desmonte.**

Este projeto é a evolução da aplicação CLI para uma arquitetura monolítica moderna em camadas, utilizando **Fastify**, **TypeScript** e **Prisma ORM** com **PostgreSQL**, em conformidade com as diretrizes de avaliação da FATEC.

---

## Arquitetura do Sistema

O projeto segue o padrão **Controller-Service-Repository (CSR)**:

* **Routes (`src/routes`)**: Definição declarativa dos endpoints HTTP com suporte a autenticação stateless JWT e controle de acesso baseado em papéis (**RBAC**).
* **Controllers (`src/controllers`)**: Manipulação de requisições e respostas HTTP.
* **Domínio (`src/domain/<módulo>`)**: um módulo por contexto (`usuario`, `auth`, `organizacao`, `lote`, `equipamento`, `relatorio`). Cada um tem um `*.service.ts` (orquestra: carrega dados, aplica regras, persiste) e um `*.rules.ts` (as regras de negócio, em funções explícitas e nomeadas). Veja a seção abaixo.
* **Repositories (`src/repositories`)**: Única camada que conversa com o **Prisma Client**, atrás de interfaces padronizadas (veja "Camada de Persistência").

---

## 🛠️ Pré-requisitos

Para executar o projeto localmente, certifique-se de ter instalado:

* **Node.js** (v20.x ou superior)
* **npm** (v9.x ou superior)
* **PostgreSQL** (v14 ou superior) em execução e com um banco criado para o projeto
* **Docker & Docker Compose** *(opcional, para execução isolada em container)*

---

## ⚙️ Variáveis de Ambiente

Copie o arquivo `.env.example` para `.env` na raiz do projeto e preencha com os seus dados:

```bash
cp .env.example .env
```

| Variável | Obrigatória | Descrição |
| --- | --- | --- |
| `NODE_ENV` | Sim | `development`, `production` ou `test`. |
| `DATABASE_URL` | Sim | String de conexão PostgreSQL (`postgresql://usuario:senha@host:5432/banco`). |
| `JWT_SECRET` | Sim | Segredo de assinatura do JWT. Em produção, mínimo de 32 caracteres. |
| `PORT` | Não | Porta HTTP (padrão `3000`). |
| `HOST` | Não | Interface de escuta (padrão `0.0.0.0`). |

A aplicação **não inicia** se alguma variável obrigatória estiver ausente ou inválida.

---

## 🚀 Guia de Instalação e Execução Local (Windows e Linux Ubuntu)

### 1. Clonar o Repositório e Instalar Dependências

```bash
# Clone o repositório
git clone https://github.com/seu-usuario/AV2.git
cd AV2

# Instale as dependências
npm install
```

### 2. Configurar o Banco de Dados e Carga Inicial (Seed)

Com o PostgreSQL rodando e o `.env` preenchido, execute o comando unificado (gera o Prisma Client, aplica as migrações e popula o banco):

```bash
npm run setup
```

Ou execute os passos individualmente:

```bash
npm run db:generate   # gera o Prisma Client
npm run db:migrate    # aplica as migrações (desenvolvimento)
npm run db:seed       # carga inicial (usuário admin)
```

### 3. Executar a Aplicação

#### Modo Desenvolvimento (Hot-reload)
```bash
npm run dev
```

#### Modo Produção (Compilado)
```bash
npm run build         # compila o TypeScript para dist/
npm run start         # inicia dist/server.js
```

Em ambientes de produção/CI, aplique as migrações com `npm run db:migrate:deploy` (não cria migrações nem pede interação).

### Scripts disponíveis

| Script | Função |
| --- | --- |
| `npm install` | Instala as dependências |
| `npm run db:generate` | Gera o Prisma Client |
| `npm run db:migrate` | Aplica migrações em desenvolvimento (`prisma migrate dev`) |
| `npm run db:migrate:deploy` | Aplica migrações pendentes em produção/CI |
| `npm run db:seed` | Executa o seed |
| `npm run db:studio` | Abre o Prisma Studio |
| `npm run dev` | Servidor em modo desenvolvimento com hot-reload |
| `npm run build` | Compila o TypeScript |
| `npm run start` | Inicia o servidor compilado (produção) |
| `npm run typecheck` | Verifica tipos sem emitir arquivos |
| `npm run check:arquitetura` | Falha se o Prisma for usado fora da camada de persistência |
| `npm run setup` | `db:generate` + `db:migrate` + `db:seed` |

A API estará acessível em `http://localhost:3000`.

## Execução via Docker (Containerização)

Construir a Imagem e Rodar o Container

### Construir a imagem Docker

```
docker build -t greencode-api .
```


### Rodar o container

O container não inclui o `.env`; as variáveis são passadas em tempo de execução. Como o `localhost` dentro do container não é o da sua máquina, ajuste o host do banco em `DATABASE_URL` (ex.: `host.docker.internal` no Windows/macOS ou o IP do host no Linux). Atenção: o `--env-file` do Docker não remove aspas, então no arquivo usado com ele os valores devem ficar **sem aspas**.

```
docker run -d -p 3000:3000 --env-file .env --name greencode-app greencode-api
```

## 3. Executar Migrações e Seed dentro do Container

```
docker exec -it greencode-app npx prisma migrate deploy
docker exec -it greencode-app npx tsx prisma/seed.ts
```


## Camada de Domínio

```
src/domain/
├── validators/      # validações reutilizáveis e puras (CNPJ, senha, data de entrada, papel, e-mail)
├── shared/          # helpers comuns (exigirEncontrado, exigirValido)
├── usuario/         # usuario.service.ts + usuario.rules.ts
├── auth/            # auth.service.ts + auth.rules.ts
├── organizacao/     # organizacao.service.ts + organizacao.rules.ts
├── lote/            # lote.service.ts + lote.rules.ts
├── equipamento/     # equipamento.service.ts + equipamento.rules.ts + equipamento.codigo.ts
└── relatorio/       # relatorio.service.ts
```

**Convenção**

| Onde | O que contém | Regras de ouro |
| --- | --- | --- |
| `validators/` | Funções `validarX(valor)` que retornam `{ valido: true }` ou `{ valido: false, mensagem }` | Puras: sem banco, sem relógio global (a data atual é parâmetro) e sem lançar erro |
| `<módulo>.rules.ts` | Regras de negócio (`exigirX`, `garantirX`, `protegerX`) | Recebem os dados já carregados e lançam erros tipados quando a regra é violada |
| `<módulo>.service.ts` | Orquestração do caso de uso | Busca dados, chama as regras, persiste. Decide e documenta se usa transação |
| `repositories/` | Acesso ao Prisma | Sem regra de negócio e sem decidir transações |

Erros de domínio (em `src/errors`): `RegraDeNegocioError` (400), `NotFoundError` (404), `ConflictError` (409), `UnauthorizedError` (401) e `ForbiddenError` (403). O handler global os converte em resposta HTTP.

### Padrão de transações

O **service** decide, de forma explícita, e registra a decisão em um comentário `Transação: SIM/NÃO` com o motivo. Usa-se `executarEmTransacao` (`src/persistence/transaction.ts`) quando há:

1. mais de uma escrita que precisa ser atômica (ex.: cadastrar equipamento e atualizar o status do lote);
2. sequência "ler → decidir → gravar" que a concorrência poderia invalidar (ex.: contar administradores antes de rebaixar um deles). Nesses casos usa-se `isolamento: 'serializavel'`; um conflito vira `409` e o cliente pode repetir a operação.

Não se usa transação em escrita única ou quando o banco já garante a invariante (constraint `unique`, *optimistic locking* por `version`). Os repositórios recebem o cliente da transação como último parâmetro (`db`, padrão `prisma`).

| Operação | Transação | Motivo |
| --- | --- | --- |
| Cadastrar equipamento | Sim (serializável) | Posição/código sequencial + status do lote |
| Movimentar equipamento | Sim | Status + histórico atômicos |
| Rebaixar/remover administrador | Sim (serializável) | Nunca ficar sem administradores |
| Alterar estado físico | Não | Escrita única com `version` |
| Criar usuário, organização, lote | Não | Escrita única (unicidade na constraint) |
| Relatórios | Não | Somente leitura |

## Camada de Persistência

```
src/persistence/   # client.ts (fábrica do PrismaClient), prisma.ts (instância única), transaction.ts
src/repositories/  # entities.ts, base.repository.ts e um repositório por agregado
```

**Regras**

- A instância do Prisma é criada em um só lugar (`src/persistence/prisma.ts`) e só `src/repositories` e `src/persistence` a importam. Serviços e controllers nunca tocam o Prisma; `npm run check:arquitetura` verifica isso.
- Os enums do Prisma chegam ao restante do código por `src/domain/shared/enums.ts` (único ponto de contato).
- Os repositórios devolvem tipos próprios (`src/repositories/entities.ts`), não os modelos do Prisma, e não contêm regra de negócio nem decidem transações.

**Contrato padrão** (`CrudRepository`), seguido por `UsuarioRepository`, `OrganizacaoRepository`, `LoteRepository` e `EquipamentoRepository`:

| Método | Observação |
| --- | --- |
| `findById(id, tx?)` | Retorna `null` se não existir |
| `findAll(filtro?, tx?)` | Filtros tipados por entidade |
| `create(data, tx?)` | |
| `update(id, data, tx?)` | Id inexistente lança P2025 (vira 404) |
| `delete(id, tx?)` | Retorna `void`; id inexistente lança P2025 |
| `count(filtro?, tx?)` | |

Leituras específicas de um caso de uso têm nome próprio (`listarComResumo`, `findDetalheById`, `findCredencialByUsuario`, `atualizarComVersao`...). O `RelatorioRepository` só tem consultas agregadas e por isso não segue o contrato CRUD.

**Dados sensíveis**

- `hashSenha` e `salt` nunca são retornados por padrão: todas as operações de `UsuarioRepository` usam `select` explícito.
- O único método que devolve o hash é `findCredencialByUsuario`, usado somente na autenticação.
- Listagens e detalhes trazem apenas os campos necessários (ex.: a organização de um lote vem como `id`, `razaoSocial` e `cnpj`).

## Contrato da API

### Autenticação

`POST /api/v1/auth/login` retorna um JWT. Envie-o nas demais rotas no cabeçalho `Authorization: Bearer <token>`. O token carrega os claims `sub` (id do usuário), `usuario` e `papel`, definidos em `src/types/auth.ts`.

### Formato das respostas

Toda resposta de sucesso segue o envelope abaixo (`message` e `meta` são opcionais):

```json
{
  "data": { },
  "message": "Lote criado com sucesso.",
  "meta": { "total": 10 }
}
```

Listagens retornam um array em `data` e a quantidade de itens em `meta.total`. Operações sem retorno (ex.: remover usuário) devolvem `"data": null` com `message`.

### Formato dos erros

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Dados da requisição inválidos.",
  "details": [{ "local": "body", "campo": "cnpj", "mensagem": "Campo obrigatório." }]
}
```

`details` aparece apenas em erros de validação (400). Os demais erros trazem somente `statusCode`, `error` e `message`.

### Validação

Os payloads (body e parâmetros de rota) são validados com **Zod** antes de chegar ao controller. Os schemas ficam em `src/schemas/` e alimentam também a documentação Swagger. Os campos devem respeitar os tipos JSON (ex.: `anoFabricacao` é número, não texto). Respostas também passam por schema, então campos que não fazem parte do contrato (como hash de senha) nunca são enviados ao cliente.

## Documentação da API (Swagger / OpenAPI)

A documentação interativa da API é gerada automaticamente e pode ser acessada após iniciar o servidor:

URL da Documentação: http://localhost:3000/docs

## Verificação de Qualidade e Tipagem

Para garantir a estrita conformidade do TypeScript sem emissão de erros:

```
npm run typecheck
```

## Compatibilidade

Windows: Windows 10 ou superior (PowerShell / CMD)

Linux: Ubuntu 24.04 LTS ou superior / distribuições derivadas

Containers: Docker / Docker Compose