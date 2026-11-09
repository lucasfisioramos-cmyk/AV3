import { createPrismaClient } from './client.js';

/**
 * Instância única do Prisma da aplicação.
 * Somente `src/repositories` e `src/persistence` podem importar este módulo
 * (verificado por `npm run check:arquitetura`). Serviços e controllers acessam
 * dados exclusivamente por meio dos repositórios.
 */
export const prisma = createPrismaClient();

export async function desconectarBanco(): Promise<void> {
  await prisma.$disconnect();
}
