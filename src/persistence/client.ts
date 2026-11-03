import { PrismaClient } from '@prisma/client';

/**
 * Fábrica ÚNICA de PrismaClient. Não depende de `env`, para poder ser usada
 * também por scripts (ex.: prisma/seed.ts) sem exigir toda a configuração da API.
 */
export function createPrismaClient(ambiente: string = process.env.NODE_ENV ?? 'production'): PrismaClient {
  return new PrismaClient({
    log: ambiente === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
  });
}
