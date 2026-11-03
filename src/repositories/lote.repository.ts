import type { Prisma } from '@prisma/client';
import { prisma } from '../persistence/prisma.js';
import type { Transacao } from '../persistence/transaction.js';
import type { StatusLote } from '../domain/shared/enums.js';
import type { CrudRepository } from './base.repository.js';
import type { Equipamento, Lote, OrganizacaoResumo } from './entities.js';

export interface CriarLoteData {
  organizacaoId: string;
  notaFiscal: string;
  transportadora: string;
  observacoes?: string | null;
  dataEntrada?: Date;
  statusProcessamento?: StatusLote;
}

export interface AtualizarLoteData {
  transportadora?: string;
  observacoes?: string | null;
  statusProcessamento?: StatusLote;
}

export interface LoteFiltro {
  organizacaoId?: string;
  statusProcessamento?: StatusLote;
}

/** Item de listagem: lote + organização resumida + total de equipamentos. */
export interface LoteComResumo extends Lote {
  organizacao: OrganizacaoResumo;
  totalEquipamentos: number;
}

/** Visão detalhada: lote + organização resumida + equipamentos. */
export interface LoteDetalhe extends Lote {
  organizacao: OrganizacaoResumo;
  equipamentos: Equipamento[];
}

export interface LoteRepository extends CrudRepository<Lote, CriarLoteData, AtualizarLoteData, LoteFiltro> {
  listarComResumo(filtro?: LoteFiltro, tx?: Transacao): Promise<LoteComResumo[]>;
  findDetalheById(id: string, tx?: Transacao): Promise<LoteDetalhe | null>;
  findByNotaFiscalEOrganizacao(notaFiscal: string, organizacaoId: string, tx?: Transacao): Promise<Lote | null>;
}

const SELECT_ORGANIZACAO_RESUMO = {
  id: true,
  razaoSocial: true,
  cnpj: true,
} as const satisfies Prisma.OrganizacaoSelect;

class PrismaLoteRepository implements LoteRepository {
  findById(id: string, tx?: Transacao) {
    return (tx ?? prisma).lote.findUnique({ where: { id } });
  }

  findAll(filtro: LoteFiltro = {}, tx?: Transacao) {
    return (tx ?? prisma).lote.findMany({ where: filtro, orderBy: { createdAt: 'desc' } });
  }

  async listarComResumo(filtro: LoteFiltro = {}, tx?: Transacao): Promise<LoteComResumo[]> {
    const lotes = await (tx ?? prisma).lote.findMany({
      where: filtro,
      include: {
        organizacao: { select: SELECT_ORGANIZACAO_RESUMO },
        _count: { select: { equipamentos: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Converte o formato do Prisma (_count) para o vocabulário da aplicação.
    return lotes.map(({ _count, ...lote }) => ({ ...lote, totalEquipamentos: _count.equipamentos }));
  }

  findDetalheById(id: string, tx?: Transacao) {
    return (tx ?? prisma).lote.findUnique({
      where: { id },
      include: {
        organizacao: { select: SELECT_ORGANIZACAO_RESUMO },
        equipamentos: { orderBy: { posicaoNoLote: 'asc' } },
      },
    });
  }

  findByNotaFiscalEOrganizacao(notaFiscal: string, organizacaoId: string, tx?: Transacao) {
    return (tx ?? prisma).lote.findFirst({ where: { notaFiscal, organizacaoId } });
  }

  create(data: CriarLoteData, tx?: Transacao) {
    return (tx ?? prisma).lote.create({ data });
  }

  update(id: string, data: AtualizarLoteData, tx?: Transacao) {
    return (tx ?? prisma).lote.update({ where: { id }, data });
  }

  async delete(id: string, tx?: Transacao) {
    await (tx ?? prisma).lote.delete({ where: { id } });
  }

  count(filtro: LoteFiltro = {}, tx?: Transacao) {
    return (tx ?? prisma).lote.count({ where: filtro });
  }
}

export const LoteRepository: LoteRepository = new PrismaLoteRepository();
