import type { Prisma } from '@prisma/client';
import { prisma } from '../persistence/prisma.js';
import type { Transacao } from '../persistence/transaction.js';
import type { EstadoFisico, StatusRastreamento, TipoEquipamento } from '../domain/shared/enums.js';
import type { CrudRepository, PaginacaoFiltro } from './base.repository.js';
import type { Equipamento, Lote, Movimentacao, OrganizacaoResumo } from './entities.js';

export interface CriarEquipamentoData {
  loteId: string;
  codigoBarrasInterno: string;
  tipo: TipoEquipamento;
  marca: string;
  modelo: string;
  anoFabricacao: number;
  estadoFisico: EstadoFisico;
  pesoQuilogramas: number;
  posicaoNoLote: number;
  statusRastreamento: StatusRastreamento;
}

export interface AtualizarEquipamentoData {
  marca?: string;
  modelo?: string;
  anoFabricacao?: number;
  pesoQuilogramas?: number;
  estadoFisico?: EstadoFisico;
  statusRastreamento?: StatusRastreamento;
}

export interface EquipamentoFiltro extends PaginacaoFiltro {
  loteId?: string;
  tipo?: TipoEquipamento;
  statusRastreamento?: StatusRastreamento;
}

export interface RegistrarMovimentacaoData {
  equipamentoId: string;
  origem: string;
  destino: string;
  responsavel: string;
  observacao?: string;
}

/** Visão de rastreamento: equipamento + lote (com organização resumida) + histórico. */
export interface EquipamentoRastreado extends Equipamento {
  lote: Lote & { organizacao: OrganizacaoResumo };
  historicoMovimentacao: Movimentacao[];
}

export interface EquipamentoRepository
  extends CrudRepository<Equipamento, CriarEquipamentoData, AtualizarEquipamentoData, EquipamentoFiltro> {
  findDetalheByIdentificador(identificador: string, tx?: Transacao): Promise<EquipamentoRastreado | null>;
  /**
   * Optimistic locking: só grava se `version` ainda for `versaoAtual` e incrementa a versão.
   * Retorna null quando a versão está desatualizada (outro processo alterou o registro).
   */
  atualizarComVersao(
    id: string,
    versaoAtual: number,
    data: Pick<AtualizarEquipamentoData, 'estadoFisico' | 'statusRastreamento'>,
    tx?: Transacao
  ): Promise<Equipamento | null>;
  /** O histórico pertence ao agregado Equipamento; não há repositório próprio de Movimentacao. */
  registrarMovimentacao(data: RegistrarMovimentacaoData, tx?: Transacao): Promise<Movimentacao>;
  contarMovimentacoes(equipamentoId: string, tx?: Transacao): Promise<number>;
}

class PrismaEquipamentoRepository implements EquipamentoRepository {
  findById(id: string, tx?: Transacao) {
    return (tx ?? prisma).equipamento.findUnique({ where: { id } });
  }

  private montarWhere(filtro: EquipamentoFiltro): Prisma.EquipamentoWhereInput {
    const where: Prisma.EquipamentoWhereInput = {};
    if (filtro.loteId) where.loteId = filtro.loteId;
    if (filtro.tipo) where.tipo = filtro.tipo;
    if (filtro.statusRastreamento) where.statusRastreamento = filtro.statusRastreamento;
    return where;
  }

  findAll(filtro: EquipamentoFiltro = {}, tx?: Transacao) {
    return (tx ?? prisma).equipamento.findMany({
      where: this.montarWhere(filtro),
      orderBy: { createdAt: 'desc' },
      skip: filtro.skip,
      take: filtro.take,
    });
  }

  findDetalheByIdentificador(identificador: string, tx?: Transacao) {
    return (tx ?? prisma).equipamento.findFirst({
      where: { OR: [{ id: identificador }, { codigoBarrasInterno: identificador }] },
      include: {
        lote: { include: { organizacao: { select: { id: true, razaoSocial: true, cnpj: true } } } },
        historicoMovimentacao: { orderBy: { dataHora: 'asc' } },
      },
    });
  }

  create(data: CriarEquipamentoData, tx?: Transacao) {
    return (tx ?? prisma).equipamento.create({ data });
  }

  update(id: string, data: AtualizarEquipamentoData, tx?: Transacao) {
    return (tx ?? prisma).equipamento.update({ where: { id }, data });
  }

  async atualizarComVersao(
    id: string,
    versaoAtual: number,
    data: Pick<AtualizarEquipamentoData, 'estadoFisico' | 'statusRastreamento'>,
    tx?: Transacao
  ) {
    const db = tx ?? prisma;
    const { count } = await db.equipamento.updateMany({
      where: { id, version: versaoAtual },
      data: { ...data, version: { increment: 1 } },
    });

    if (count === 0) return null;
    return db.equipamento.findUnique({ where: { id } });
  }

  async delete(id: string, tx?: Transacao) {
    await (tx ?? prisma).equipamento.delete({ where: { id } });
  }

  count(filtro: EquipamentoFiltro = {}, tx?: Transacao) {
    return (tx ?? prisma).equipamento.count({ where: this.montarWhere(filtro) });
  }

  registrarMovimentacao(data: RegistrarMovimentacaoData, tx?: Transacao) {
    return (tx ?? prisma).movimentacao.create({ data });
  }

  contarMovimentacoes(equipamentoId: string, tx?: Transacao) {
    return (tx ?? prisma).movimentacao.count({ where: { equipamentoId } });
  }
}

export const EquipamentoRepository: EquipamentoRepository = new PrismaEquipamentoRepository();
