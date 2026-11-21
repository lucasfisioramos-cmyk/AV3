import type { Prisma } from '@prisma/client';
import type {
  EstadoFisico,
  MetricType,
  StatusLote,
  StatusRastreamento,
  TipoEquipamento,
} from '../domain/shared/enums.js';
import { prisma } from './prisma.js';
import type { Transacao } from './transaction.js';

export type AnalyticsPayload = Record<string, unknown>;

export interface AnalyticsHistoryRecord {
  id: string;
  metricType: MetricType;
  dimension: string;
  payload: AnalyticsPayload;
  calculatedAt: Date;
}

export interface SaveAnalyticsHistoryData {
  metricType: MetricType;
  dimension: string;
  payload: AnalyticsPayload;
  calculatedAt?: Date;
}

export interface EquipmentRULPredictionRecord {
  id: string;
  tipoEquipamento: TipoEquipamento;
  marca: string;
  modelo: string;
  slope: number;
  intercept: number;
  estimatedDaysLeft: number;
  predictedEndDate: Date;
  createdAt: Date;
}

export interface SaveRulPredictionData {
  tipoEquipamento: TipoEquipamento;
  marca: string;
  modelo: string;
  slope: number;
  intercept: number;
  estimatedDaysLeft: number;
  predictedEndDate: Date;
}

export interface RulPredictionFilter {
  tipoEquipamento?: TipoEquipamento;
  marca?: string;
  modelo?: string;
  limit?: number;
}

export interface EquipamentoAnaliseFilter {
  tipo?: TipoEquipamento;
  marca?: string;
  modelo?: string;
  loteId?: string;
  organizacaoId?: string;
}

export interface EquipamentoAnaliseRecord {
  id: string;
  tipo: TipoEquipamento;
  marca: string;
  modelo: string;
  anoFabricacao: number;
  estadoFisico: EstadoFisico;
  pesoQuilogramas: number;
  statusRastreamento: StatusRastreamento;
  loteId: string;
  createdAt: Date;
  lote: {
    id: string;
    organizacaoId: string;
    dataEntrada: Date;
    statusProcessamento: StatusLote;
  };
}

export interface LoteAnaliseRecord {
  id: string;
  organizacaoId: string;
  dataEntrada: Date;
  statusProcessamento: StatusLote;
  createdAt: Date;
  updatedAt: Date;
  totalEquipamentos: number;
}

export interface MovimentacaoAnaliseFilter {
  equipamentoId?: string;
  desde?: Date;
  ate?: Date;
}

export interface MovimentacaoAnaliseRecord {
  id: string;
  equipamentoId: string;
  loteId: string;
  dataHora: Date;
  origem: string;
  destino: string;
  responsavel: string;
  createdAt: Date;
}

export interface AnalyticsRepository {
  saveHistory(data: SaveAnalyticsHistoryData, tx?: Transacao): Promise<AnalyticsHistoryRecord>;
  findHistoryByType(
    metricType: MetricType,
    limit?: number,
    tx?: Transacao,
  ): Promise<AnalyticsHistoryRecord[]>;
  saveRulPrediction(
    data: SaveRulPredictionData,
    tx?: Transacao,
  ): Promise<EquipmentRULPredictionRecord>;
  findRulPredictions(
    filters?: RulPredictionFilter,
    tx?: Transacao,
  ): Promise<EquipmentRULPredictionRecord[]>;
  findEquipamentosParaAnalise(
    filters?: EquipamentoAnaliseFilter,
    tx?: Transacao,
  ): Promise<EquipamentoAnaliseRecord[]>;
  findLotesParaAnalise(tx?: Transacao): Promise<LoteAnaliseRecord[]>;
  findMovimentacoesParaAnalise(
    filters?: MovimentacaoAnaliseFilter,
    tx?: Transacao,
  ): Promise<MovimentacaoAnaliseRecord[]>;
}

const SELECT_HISTORY = {
  id: true,
  metricType: true,
  dimension: true,
  payload: true,
  calculatedAt: true,
} as const satisfies Prisma.AnalyticsHistorySelect;

const SELECT_RUL = {
  id: true,
  tipoEquipamento: true,
  marca: true,
  modelo: true,
  slope: true,
  intercept: true,
  estimatedDaysLeft: true,
  predictedEndDate: true,
  createdAt: true,
} as const satisfies Prisma.EquipmentRULPredictionSelect;

const SELECT_EQUIPAMENTO_ANALISE = {
  id: true,
  tipo: true,
  marca: true,
  modelo: true,
  anoFabricacao: true,
  estadoFisico: true,
  pesoQuilogramas: true,
  statusRastreamento: true,
  loteId: true,
  createdAt: true,
  lote: {
    select: {
      id: true,
      organizacaoId: true,
      dataEntrada: true,
      statusProcessamento: true,
    },
  },
} as const satisfies Prisma.EquipamentoSelect;

const SELECT_LOTE_ANALISE = {
  id: true,
  organizacaoId: true,
  dataEntrada: true,
  statusProcessamento: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: { equipamentos: true },
  },
} as const satisfies Prisma.LoteSelect;

const SELECT_MOVIMENTACAO_ANALISE = {
  id: true,
  equipamentoId: true,
  dataHora: true,
  origem: true,
  destino: true,
  responsavel: true,
  createdAt: true,
  equipamento: {
    select: {
      loteId: true,
    },
  },
} as const satisfies Prisma.MovimentacaoSelect;

function toHistoryRecord(row: {
  id: string;
  metricType: MetricType;
  dimension: string;
  payload: Prisma.JsonValue;
  calculatedAt: Date;
}): AnalyticsHistoryRecord {
  const payload =
    row.payload !== null && typeof row.payload === 'object' && !Array.isArray(row.payload)
      ? (row.payload as AnalyticsPayload)
      : {};
  return {
    id: row.id,
    metricType: row.metricType,
    dimension: row.dimension,
    payload,
    calculatedAt: row.calculatedAt,
  };
}

class PrismaAnalyticsRepository implements AnalyticsRepository {
  async saveHistory(
    data: SaveAnalyticsHistoryData,
    tx?: Transacao,
  ): Promise<AnalyticsHistoryRecord> {
    const row = await (tx ?? prisma).analyticsHistory.create({
      data: {
        metricType: data.metricType,
        dimension: data.dimension,
        payload: data.payload as Prisma.InputJsonValue,
        calculatedAt: data.calculatedAt,
      },
      select: SELECT_HISTORY,
    });
    return toHistoryRecord(row);
  }

  async findHistoryByType(
    metricType: MetricType,
    limit?: number,
    tx?: Transacao,
  ): Promise<AnalyticsHistoryRecord[]> {
    const rows = await (tx ?? prisma).analyticsHistory.findMany({
      where: { metricType },
      select: SELECT_HISTORY,
      orderBy: { calculatedAt: 'desc' },
      take: limit,
    });
    return rows.map(toHistoryRecord);
  }

  saveRulPrediction(
    data: SaveRulPredictionData,
    tx?: Transacao,
  ): Promise<EquipmentRULPredictionRecord> {
    return (tx ?? prisma).equipmentRULPrediction.create({
      data,
      select: SELECT_RUL,
    });
  }

  findRulPredictions(
    filters: RulPredictionFilter = {},
    tx?: Transacao,
  ): Promise<EquipmentRULPredictionRecord[]> {
    return (tx ?? prisma).equipmentRULPrediction.findMany({
      where: {
        tipoEquipamento: filters.tipoEquipamento,
        marca: filters.marca,
        modelo: filters.modelo,
      },
      select: SELECT_RUL,
      orderBy: { createdAt: 'desc' },
      take: filters.limit,
    });
  }

  findEquipamentosParaAnalise(
    filters: EquipamentoAnaliseFilter = {},
    tx?: Transacao,
  ): Promise<EquipamentoAnaliseRecord[]> {
    return (tx ?? prisma).equipamento.findMany({
      where: {
        tipo: filters.tipo,
        marca: filters.marca,
        modelo: filters.modelo,
        loteId: filters.loteId,
        lote: filters.organizacaoId ? { organizacaoId: filters.organizacaoId } : undefined,
      },
      select: SELECT_EQUIPAMENTO_ANALISE,
      orderBy: { createdAt: 'asc' },
    });
  }

  async findLotesParaAnalise(tx?: Transacao): Promise<LoteAnaliseRecord[]> {
    const rows = await (tx ?? prisma).lote.findMany({
      select: SELECT_LOTE_ANALISE,
      orderBy: { dataEntrada: 'asc' },
    });
    return rows.map((row) => ({
      id: row.id,
      organizacaoId: row.organizacaoId,
      dataEntrada: row.dataEntrada,
      statusProcessamento: row.statusProcessamento,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      totalEquipamentos: row._count.equipamentos,
    }));
  }

  async findMovimentacoesParaAnalise(
    filters: MovimentacaoAnaliseFilter = {},
    tx?: Transacao,
  ): Promise<MovimentacaoAnaliseRecord[]> {
    const dataHora: Prisma.DateTimeFilter | undefined =
      filters.desde || filters.ate
        ? {
            gte: filters.desde,
            lte: filters.ate,
          }
        : undefined;

    const rows = await (tx ?? prisma).movimentacao.findMany({
      where: {
        equipamentoId: filters.equipamentoId,
        dataHora,
      },
      select: SELECT_MOVIMENTACAO_ANALISE,
      orderBy: { dataHora: 'asc' },
    });
    return rows.map((row) => ({
      id: row.id,
      equipamentoId: row.equipamentoId,
      loteId: row.equipamento.loteId,
      dataHora: row.dataHora,
      origem: row.origem,
      destino: row.destino,
      responsavel: row.responsavel,
      createdAt: row.createdAt,
    }));
  }
}

export const AnalyticsRepository: AnalyticsRepository = new PrismaAnalyticsRepository();
