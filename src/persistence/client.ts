import { PrismaClient } from '@prisma/client';

/**
 * Fábrica ÚNICA de PrismaClient. Não depende de `env`, para poder ser usada
 * também por scripts (ex.: prisma/seed.ts) sem exigir toda a configuração da API.
 */
export function createPrismaClient(): PrismaClient {
  // Nunca registre 'query': os parâmetros das consultas incluem dados sensíveis (ex.: hash de senha).
  return new PrismaClient({ log: ['warn', 'error'] });
}
