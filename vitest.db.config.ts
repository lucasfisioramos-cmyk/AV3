import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/integration/db/**/*.test.ts'],
    // Não carrega tests/setup.ts para permitir acesso ao PostgreSQL e repositórios reais
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:root@localhost:5432/av2',
      JWT_SECRET: 'segredo-de-teste-com-mais-de-32-caracteres!!',
      LOG_LEVEL: 'silent',
    },
    testTimeout: 30_000,
    fileParallelism: false,
  },
});
