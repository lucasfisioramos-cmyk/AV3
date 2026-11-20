import { Prisma } from '@prisma/client';
import { prisma } from '../persistence/prisma.js';
import type { Transacao } from '../persistence/transaction.js';
import type { StatusLote } from '../domain/shared/enums.js';
import { ConflictError } from '../errors/app-error.js';
import type { CrudRepository, PaginacaoFiltro } from './base.repository.js';
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

export interface LoteFiltro extends PaginacaoFiltro {
  organizacaoId?: string;
  statusProcessamento?: StatusLote;
  dataEntradaInicio?: Date;
  dataEntradaFim?: Date;
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
  private montarWhere(filtro: LoteFiltro): Prisma.LoteWhereInput {
    const where: Prisma.LoteWhereInput = {};
    if (filtro.organizacaoId) where.organizacaoId = filtro.organizacaoId;
    if (filtro.statusProcessamento) where.statusProcessamento = filtro.statusProcessamento;
    if (filtro.dataEntradaInicio || filtro.dataEntradaFim) {
      where.dataEntrada = {};
      if (filtro.dataEntradaInicio) where.dataEntrada.gte = filtro.dataEntradaInicio;
      if (filtro.dataEntradaFim) where.dataEntrada.lte = filtro.dataEntradaFim;
    }
    return where;
  }

  findById(id: string, tx?: Transacao) {
    return (tx ?? prisma).lote.findUnique({ where: { id } });
  }

  findAll(filtro: LoteFiltro = {}, tx?: Transacao) {
    return (tx ?? prisma).lote.findMany({
      where: this.montarWhere(filtro),
      orderBy: { createdAt: 'desc' },
      skip: filtro.skip,
      take: filtro.take,
    });
  }

  async listarComResumo(filtro: LoteFiltro = {}, tx?: Transacao): Promise<LoteComResumo[]> {
    const lotes = await (tx ?? prisma).lote.findMany({
      where: this.montarWhere(filtro),
      include: {
        organizacao: { select: SELECT_ORGANIZACAO_RESUMO },
        _count: { select: { equipamentos: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: filtro.skip,
      take: filtro.take,
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

  async create(data: CriarLoteData, tx?: Transacao) {
    try {
      return await (tx ?? prisma).lote.create({ data });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictError(
          `Já existe um lote cadastrado com a Nota Fiscal "${data.notaFiscal}" para esta organização.`
        );
      }
      throw error;
    }
  }

  update(id: string, data: AtualizarLoteData, tx?: Transacao) {
    return (tx ?? prisma).lote.update({ where: { id }, data });
  }

  async delete(id: string, tx?: Transacao) {
    await (tx ?? prisma).lote.delete({ where: { id } });
  }

  count(filtro: LoteFiltro = {}, tx?: Transacao) {
    return (tx ?? prisma).lote.count({ where: this.montarWhere(filtro) });
  }
}

export const LoteRepository: LoteRepository = new PrismaLoteRepository();
