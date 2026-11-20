import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Configurações de Docker e Orquestração (TASK-16 / Q4, Q5)', () => {
  const rootDir = resolve(__dirname, '../../../');

  describe('1. Dockerfile Multi-stage', () => {
    const dockerfilePath = resolve(rootDir, 'dockerfile');

    it('arquivo dockerfile existe no projeto', () => {
      expect(existsSync(dockerfilePath)).toBe(true);
    });

    it('possui estágios separados de build e runtime (multi-stage) com Node 22 Alpine', () => {
      const conteudo = readFileSync(dockerfilePath, 'utf-8');
      expect(conteudo).toMatch(/FROM\s+node:22-alpine\s+AS\s+builder/i);
      expect(conteudo).toMatch(/FROM\s+node:22-alpine\s+AS\s+runner/i);
    });

    it('executa com usuário não-root (USER node) no estágio de runtime por segurança', () => {
      const conteudo = readFileSync(dockerfilePath, 'utf-8');
      expect(conteudo).toMatch(/USER\s+node/);
    });

    it('estágio de build compila Prisma e TypeScript, e remove devDependencies', () => {
      const conteudo = readFileSync(dockerfilePath, 'utf-8');
      expect(conteudo).toContain('npm run db:generate');
      expect(conteudo).toContain('npm run build');
      expect(conteudo).toContain('npm prune --omit=dev');
    });

    it('comando de inicialização executa migração automática antes de iniciar o servidor', () => {
      const conteudo = readFileSync(dockerfilePath, 'utf-8');
      expect(conteudo).toContain('npx prisma migrate deploy');
      expect(conteudo).toContain('node dist/server.js');
    });
  });

  describe('2. docker-compose.yml', () => {
    const composePath = resolve(rootDir, 'docker-compose.yml');

    it('arquivo docker-compose.yml existe no projeto', () => {
      expect(existsSync(composePath)).toBe(true);
    });

    it('define o serviço de banco PostgreSQL 16 com healthcheck e volume persistente', () => {
      const conteudo = readFileSync(composePath, 'utf-8');
      expect(conteudo).toContain('image: postgres:16-alpine');
      expect(conteudo).toContain('healthcheck:');
      expect(conteudo).toContain('pg_isready');
      expect(conteudo).toContain('postgres_data:');
    });

    it('define o serviço api aguardando o banco estar saudável (service_healthy)', () => {
      const conteudo = readFileSync(composePath, 'utf-8');
      expect(conteudo).toContain('condition: service_healthy');
      expect(conteudo).toContain('DATABASE_URL:');
      expect(conteudo).toContain('NODE_ENV: production');
    });
  });

  describe('3. .dockerignore', () => {
    const dockerignorePath = resolve(rootDir, 'dockerignore');
    const dotDockerignorePath = resolve(rootDir, '.dockerignore');

    it('ignora diretórios pesados e dados sensíveis (node_modules, dist, .env, .git, coverage)', () => {
      const caminho = existsSync(dotDockerignorePath) ? dotDockerignorePath : dockerignorePath;
      expect(existsSync(caminho)).toBe(true);

      const conteudo = readFileSync(caminho, 'utf-8');
      expect(conteudo).toContain('node_modules');
      expect(conteudo).toContain('dist');
      expect(conteudo).toContain('.env');
      expect(conteudo).toContain('.git');
      expect(conteudo).toContain('coverage');
    });
  });
});
