import { prisma } from '../persistence/prisma.js';
import type { Transacao } from '../persistence/transaction.js';
import type { EstadoFisico, StatusRastreamento, TipoEquipamento } from '../domain/shared/enums.js';
import type { CrudRepository } from './base.repository.js';
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
  estadoFisico?: EstadoFisico;
  statusRastreamento?: StatusRastreamento;
}

export interface EquipamentoFiltro {
  loteId?: string;
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
}

class PrismaEquipamentoRepository implements EquipamentoRepository {
  findById(id: string, tx?: Transacao) {
    return (tx ?? prisma).equipamento.findUnique({ where: { id } });
  }

  findAll(filtro: EquipamentoFiltro = {}, tx?: Transacao) {
    return (tx ?? prisma).equipamento.findMany({ where: filtro, orderBy: { createdAt: 'desc' } });
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
    return (tx ?? prisma).equipamento.count({ where: filtro });
  }

  registrarMovimentacao(data: RegistrarMovimentacaoData, tx?: Transacao) {
    return (tx ?? prisma).movimentacao.create({ data });
  }
}

export const EquipamentoRepository: EquipamentoRepository = new PrismaEquipamentoRepository();
