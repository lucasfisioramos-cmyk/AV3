# --- Estágio 1: Build da aplicação ---
FROM node:22-alpine AS builder

WORKDIR /app

# Copia manifestos de dependência e schemas do Prisma para aproveitar cache de camadas
COPY package*.json ./
COPY prisma ./prisma/

# Instala todas as dependências necessárias para a compilação
RUN npm ci

# Copia arquivos de configuração e código-fonte
COPY tsconfig.json ./
COPY src ./src/

# Gera o Prisma Client e compila o TypeScript para dist/
RUN npm run db:generate
RUN npm run build

# Remove devDependencies preservando apenas dependências de produção e o client gerado
RUN npm prune --omit=dev

# --- Estágio 2: Runtime de Produção ---
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Execução com usuário sem privilégios de root (segurança em contêineres)
USER node

# Copia apenas os artefatos compilados, dependências de produção e schemas de migração
COPY --chown=node:node --from=builder /app/package*.json ./
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/dist ./dist
COPY --chown=node:node --from=builder /app/prisma ./prisma

EXPOSE 3000

# Executa migrações pendentes do banco antes de iniciar o servidor da API
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
