import { StatusLote } from '@prisma/client';
import { prisma } from '../persistence/prisma.js';
import type { Transacao } from '../persistence/transaction.js';

export class LoteRepository {
  static async findAll() {
    return prisma.lote.findMany({
      include: {
        organizacao: { select: { id: true, razaoSocial: true, cnpj: true } },
        _count: { select: { equipamentos: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async findById(id: string) {
    return prisma.lote.findUnique({
      where: { id },
      include: { organizacao: true, equipamentos: true },
    });
  }

  /** Lote sem relacionamentos (leve), para checagens de regra de negócio. */
  static async findResumoById(id: string, db: Transacao = prisma) {
    return db.lote.findUnique({ where: { id } });
  }

  static async atualizarStatus(id: string, statusProcessamento: StatusLote, db: Transacao = prisma) {
    return db.lote.update({ where: { id }, data: { statusProcessamento } });
  }

  static async findByNotaFiscalEOrganizacao(notaFiscal: string, organizacaoId: string) {
    return prisma.lote.findFirst({
      where: { notaFiscal, organizacaoId },
    });
  }

  static async create(data: {
    organizacaoId: string;
    notaFiscal: string;
    transportadora: string;
    observacoes?: string;
  }) {
    return prisma.lote.create({
      data: {
        ...data,
        statusProcessamento: StatusLote.RECEBIDO,
      },
    });
  }
}