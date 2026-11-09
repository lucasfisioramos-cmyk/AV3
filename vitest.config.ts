import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    // Variáveis mínimas para a aplicação subir em teste (sem banco real).
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://teste:teste@localhost:5432/teste',
      JWT_SECRET: 'segredo-de-teste-com-mais-de-32-caracteres!!',
      LOG_LEVEL: 'silent',
    },
    testTimeout: 20_000, // bcrypt com custo 12 é propositalmente lento
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        'src/server.ts', // ponto de entrada (listen/sinais)
        'src/types/**',
        // Acesso real ao Prisma: nos testes os repositórios são substituídos por versões em memória
        // (tests/helpers/fakes.ts). Cobrir estes arquivos exige um Postgres de teste.
        'src/repositories/**',
        'src/persistence/**',
      ],
      thresholds: {
        // Piso global
        lines: 80,
        functions: 80,
        statements: 80,
        branches: 70,
        // Áreas críticas: autenticação, autorização, regras de negócio e proteções de admin
        'src/security/**': { lines: 90, functions: 90, statements: 90, branches: 80 },
        'src/domain/auth/**': { lines: 90, functions: 90, statements: 90, branches: 80 },
        'src/domain/validators/**': { lines: 95, functions: 95, statements: 95, branches: 90 },
        'src/domain/**/*.rules.ts': { lines: 90, functions: 90, statements: 90, branches: 80 },
        'src/domain/usuario/usuario.service.ts': { lines: 90, functions: 90, statements: 90, branches: 80 },
        'src/domain/organizacao/organizacao.service.ts': { lines: 90, functions: 90, statements: 90, branches: 80 },
        'src/domain/lote/lote.service.ts': { lines: 90, functions: 90, statements: 90, branches: 80 },
      },
    },
  },
});
