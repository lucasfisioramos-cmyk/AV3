# ♻️ Greencode API

API RESTful para gestão e rastreabilidade de ativos eletrônicos em logística reversa: recebimento de lotes, triagem, desmonte e destinação de equipamentos.

Evolução da aplicação CLI da AV1 para um monólito em camadas com **Fastify 5**, **TypeScript**, **Zod**, **Prisma 6** e **PostgreSQL** (projeto acadêmico FATEC).

## Índice

- [Começando](#começando) · [Variáveis de ambiente](#variáveis-de-ambiente) · [Scripts](#scripts)
- [Produção e Docker](#produção-e-docker)
- [Documentação técnica](#documentação-técnica)
- [Testes e CI](#testes-e-integração-contínua) · [Problemas comuns](#problemas-comuns)

## Começando

**Requisitos:** Node.js 20+, npm 9+ e PostgreSQL 14+ rodando, com um banco vazio criado para o projeto.

```bash
git clone <url-do-repositório>
cd <pasta-do-projeto>
npm ci                  # instala exatamente o package-lock.json
cp .env.example .env    # (Windows PowerShell: Copy-Item .env.example .env) e edite DATABASE_URL e JWT_SECRET
npm run setup           # prisma generate + migrações + seed do administrador
npm run dev             # http://localhost:3000, com hot-reload
```

- Swagger (contrato completo da API): http://localhost:3000/docs
- Health check: http://localhost:3000/api/v1/health
- Login inicial: usuário `admin`; em desenvolvimento a senha é `Greencode#Dev2026` (ou a de `SEED_ADMIN_PASSWORD`). **Troque-a** fora do ambiente local.

> Depois de `npm ci`/`npm install`, rode `npm run db:generate` se o Prisma Client não existir (veja [Problemas comuns](#problemas-comuns)).

## Variáveis de ambiente

Copie `.env.example` para `.env`. A aplicação **não inicia** se alguma variável obrigatória estiver ausente ou inválida (todos os problemas são listados de uma vez).

| Variável | Obrigatória | Descrição |
| --- | --- | --- |
| `NODE_ENV` | Sim | `development`, `production` ou `test` |
| `DATABASE_URL` | Sim | `postgresql://usuario:senha@host:5432/banco?schema=public` |
| `JWT_SECRET` | Sim | Segredo de assinatura do JWT. Em produção, mínimo de 32 caracteres |
| `PORT` | Não | Porta HTTP (padrão `3000`) |
| `HOST` | Não | Interface de escuta (padrão `0.0.0.0`) |
| `JWT_EXPIRES_IN` | Não | Validade do token: número + `s`, `m`, `h` ou `d` (padrão `8h`) |
| `JWT_ISSUER` | Não | Emissor `iss` (padrão `greencode-api`) |
| `JWT_AUDIENCE` | Não | Público `aud` (padrão `greencode-clients`) |
| `LOG_LEVEL` | Não | `fatal`…`trace` ou `silent`. Padrão: `info` (produção), `debug` (dev), `silent` (teste) |
| `SEED_ADMIN_PASSWORD` | Só no seed | Senha do admin criado pelo seed. Obrigatória fora de `development`/`test` e deve respeitar a política de senha |

Gere um segredo forte com: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.

## Scripts

| Script | Função |
| --- | --- |
| `npm run dev` | Servidor em desenvolvimento (hot-reload) |
| `npm run build` / `npm start` | Compila para `dist/` / inicia o compilado (produção) |
| `npm run setup` | `db:generate` + `db:migrate` + `db:seed` |
| `npm run db:generate` | Gera o Prisma Client |
| `npm run db:migrate` | Cria/aplica migrações em desenvolvimento |
| `npm run db:migrate:deploy` | Aplica migrações pendentes (produção/CI, sem interação) |
| `npm run db:seed` | Cria/atualiza o usuário administrador |
| `npm run db:studio` | Interface do Prisma para inspecionar o banco |
| `npm run typecheck` | Tipos do código (`tsc --noEmit`) |
| `npm run typecheck:tests` | Tipos do código **e** dos testes |
| `npm run check:arquitetura` | Falha se o Prisma for usado fora da camada de persistência |
| `npm test` / `npm run test:watch` | Suíte de testes (Vitest) |
| `npm run test:coverage` | Testes + cobertura com limites mínimos |

## Produção e Docker

### Checklist de produção

1. **Ambiente:** `NODE_ENV=production`, `DATABASE_URL`, `JWT_SECRET` com 32+ caracteres aleatórios (guarde em um gerenciador de segredos, nunca no Git) e `JWT_EXPIRES_IN` curto (ex.: `1h`): não há revogação imediata de token.
2. **Banco:** `npm run db:migrate:deploy` (nunca `db:migrate` em produção).
3. **Seed (1ª vez):** `SEED_ADMIN_PASSWORD='<senha forte>' npm run db:seed`.
4. **Build e start:** `npm ci && npm run db:generate && npm run build && npm start`.
5. **Rede:** a API não faz TLS, CORS nem limite de tentativas de login. Publique atrás de um proxy reverso com HTTPS (e *rate limit*, se exposta à internet).
6. **Operação:** use `/api/v1/health` como *readiness/liveness*. O servidor encerra com `SIGINT`/`SIGTERM` fechando as conexões do banco. Logs em JSON no stdout.

### Docker

```bash
docker build -t greencode-api .
docker run -d -p 3000:3000 --env-file .env --name greencode-app greencode-api
docker exec -it greencode-app npx prisma migrate deploy
docker exec -it greencode-app npx tsx prisma/seed.ts
```

- O container **não inclui o `.env`**: as variáveis entram em tempo de execução.
- Dentro do container `localhost` não é a sua máquina: aponte `DATABASE_URL` para o host do banco (`host.docker.internal` no Windows/macOS, IP do host no Linux, ou o nome do serviço em uma rede Docker).
- O `--env-file` do Docker **não remove aspas**: nesse arquivo deixe os valores sem aspas.
- A imagem mantém as dependências de desenvolvimento (necessárias para compilar e para a CLI do Prisma) e não é otimizada para tamanho. Não há `docker-compose`; o PostgreSQL deve existir à parte.

## Documentação técnica

| Documento | Conteúdo |
| --- | --- |
| [docs/arquitetura.md](docs/arquitetura.md) | Camadas, ciclo da requisição, persistência, transações, como evoluir o código |
| [docs/autenticacao.md](docs/autenticacao.md) | Fluxo de login, senhas, JWT, matriz de permissões por papel, limitações |
| [docs/regras-de-negocio.md](docs/regras-de-negocio.md) | Regras por módulo (usuário, organização, lote, equipamento) e onde estão no código |
| [docs/api.md](docs/api.md) | Endpoints, papéis, formato de resposta e erros, exemplos |

Estrutura resumida:

```
src/
├── routes/ controllers/ schemas/   # HTTP: rotas, controllers finos, contratos Zod
├── domain/<módulo>/                # *.service.ts (casos de uso) + *.rules.ts (regras) + validators/
├── repositories/ persistence/      # único acesso ao Prisma; transações
├── security/ errors/ config/ http/ # JWT/RBAC, erros tipados, ambiente/logger, envelope de resposta
prisma/                             # schema, migrações e seed
tests/                              # unit/ e integration/ (banco em memória)
scripts/                            # check-prisma-boundary.mjs
```

## Testes e Integração Contínua

```bash
npm test                # suíte completa
npm run test:coverage   # com cobertura e limites mínimos
```

**Não é necessário PostgreSQL para rodar os testes.** Repositórios e transação são substituídos por um banco em memória (`tests/helpers/fakes.ts`) que implementa os mesmos contratos de `src/repositories`; serviços, regras, rotas, validação, JWT e tratamento de erros rodam de verdade (via `app.inject`).

| Tipo | Local | O que cobre |
| --- | --- | --- |
| Unitários | `tests/unit` | Validadores, hash de senha, regras e serviços, mapeamento de erros, `env`, redação de logs |
| Integração (HTTP) | `tests/integration` | Login, criação de usuário, matriz papel × rota, JWT forjado/expirado, proteção do último administrador, erros de negócio |

**Cobertura mínima** (`vitest.config.ts`): global 80% (ramos 70%) e limites mais altos em segurança, autenticação, validadores, regras de domínio e serviços de usuário, organização e lote.

**CI** (`.github/workflows/ci.yml`): em todo *pull request* e em *push* para `main`/`master`, com Node 20 e 22: `npm ci` → `prisma generate` → `tsc --noEmit` → tipos dos testes → `check:arquitetura` → testes com cobertura → `build`.

**Limitação:** como o banco é simulado, o comportamento real do PostgreSQL (isolamento serializável, constraints, migrações) não é exercitado. Um job de CI com PostgreSQL real é o próximo passo natural.

## Problemas comuns

| Sintoma | Causa e solução |
| --- | --- |
| `Cannot convert undefined or null to object` em `Object.values(PapelUsuario)`, muitos testes falhando | Prisma Client não gerado (acontece após `npm ci`, que recria o `node_modules`). Rode `npm run db:generate` |
| Aviso `install-scripts ... not yet covered by allowScripts` no `npm ci` | Informativo do npm; os scripts de instalação de Prisma, bcrypt e esbuild não rodaram. Gere o client com `npm run db:generate` |
| A aplicação não sobe e lista variáveis inválidas | Corrija o `.env` conforme a [tabela acima](#variáveis-de-ambiente) |
| `P1001` / 503 ao chamar a API | Banco inacessível: confira `DATABASE_URL`, host e se o PostgreSQL está rodando |
| `git am` falha com "does not match index" | Há alteração local no arquivo; descarte-a com `git checkout -- <arquivo>` e repita |
| Seed recusa a senha | `SEED_ADMIN_PASSWORD` não respeita a política (8+ caracteres, maiúscula, minúscula, número, símbolo, sem o nome `admin`) ou não foi definida fora de dev |

## Limitações conhecidas

- Token JWT não é revogável antes de expirar (use validade curta).
- Sem CORS, *rate limit* nem TLS embutidos.
- O modelo `Contrato` existe no banco, mas não há endpoint.
- Testes não usam PostgreSQL real.
- `npm audit` aponta avisos em dependências de **desenvolvimento** (Vitest e transitivas); não afetam o build de produção.

## Compatibilidade

Windows 10 ou superior (PowerShell/CMD) e Linux (Ubuntu 24.04 LTS ou derivadas); containers via Docker.
