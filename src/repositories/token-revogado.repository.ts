import type { Prisma } from '@prisma/client';
import { prisma } from '../persistence/prisma.js';
import type { Transacao } from '../persistence/transaction.js';
import type { TokenRevogado } from './entities.js';

export interface CriarTokenRevogadoData {
  jti: string;
  expiresAt: Date;
  motivo: string;
}

export interface TokenRevogadoRepository {
  criar(data: CriarTokenRevogadoData, tx?: Transacao): Promise<TokenRevogado>;
  findByJti(jti: string, tx?: Transacao): Promise<TokenRevogado | null>;
  isRevogado(jti: string, tx?: Transacao): Promise<boolean>;
  limparExpirados(dataReferencia?: Date, tx?: Transacao): Promise<number>;
}

class PrismaTokenRevogadoRepository implements TokenRevogadoRepository {
  criar(data: CriarTokenRevogadoData, tx?: Transacao): Promise<TokenRevogado> {
    return (tx ?? prisma).tokenRevogado.create({ data });
  }

  findByJti(jti: string, tx?: Transacao): Promise<TokenRevogado | null> {
    return (tx ?? prisma).tokenRevogado.findUnique({ where: { jti } });
  }

  async isRevogado(jti: string, tx?: Transacao): Promise<boolean> {
    const total = await (tx ?? prisma).tokenRevogado.count({ where: { jti } });
    return total > 0;
  }

  async limparExpirados(dataReferencia: Date = new Date(), tx?: Transacao): Promise<number> {
    const resultado = await (tx ?? prisma).tokenRevogado.deleteMany({
      where: {
        expiresAt: {
          lt: dataReferencia,
        },
      },
    });
    return resultado.count;
  }
}

export const TokenRevogadoRepository: TokenRevogadoRepository = new PrismaTokenRevogadoRepository();
