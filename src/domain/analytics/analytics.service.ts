import {
  AnalyticsRepository,
  type AnalyticsHistoryRecord,
  type EquipamentoAnaliseFilter,
  type EquipmentRULPredictionRecord,
  type RulPredictionFilter,
} from '../../persistence/analytics.repository.js';
import { MetricType, StatusLote, type TipoEquipamento } from '../shared/enums.js';
import { AnalyticsRules } from './analytics.rules.js';
import type {
  EficienciaOperacionalResult,
  LoteEficienciaInput,
  RentabilidadeAnaliseResult,
  RulPredictionResult,
} from './analytics.types.js';

const STATUS_LOTES_CONCLUIDOS: ReadonlySet<StatusLote> = new Set([
  StatusLote.TRIAGEM_CONCLUIDA,
  StatusLote.ENCAMINHADO,
  StatusLote.FINALIZADO,
]);

function formatarPeriodoAnoMes(data: Date): string {
  const ano = data.getUTCFullYear();
  const mes = String(data.getUTCMonth() + 1).padStart(2, '0');
  return `${ano}-${mes}`;
}

export class AnalyticsService {
  /**
   * RF01 + RF04 — Calcula estatísticas de eficiência operacional dos lotes concluídos
   * e persiste o snapshot em AnalyticsHistory (metricType = OPERATIONAL_EFFICIENCY).
   */
  static async gerarAnaliseEficiencia(
    periodo?: string,
    dataReferencia: Date = new Date(),
  ): Promise<EficienciaOperacionalResult> {
    const [lotes, movimentacoes] = await Promise.all([
      AnalyticsRepository.findLotesParaAnalise(),
      AnalyticsRepository.findMovimentacoesParaAnalise(),
    ]);

    const movsPorLote = new Map<string, { responsaveis: string[]; ultimaDataHora?: Date }>();
    for (const mov of movimentacoes) {
      if (!mov.loteId) continue;
      const atual = movsPorLote.get(mov.loteId) ?? { responsaveis: [] };
      atual.responsaveis.push(mov.responsavel);
      if (!atual.ultimaDataHora || mov.dataHora > atual.ultimaDataHora) {
        atual.ultimaDataHora = mov.dataHora;
      }
      movsPorLote.set(mov.loteId, atual);
    }

    const lotesConcluidos = lotes.filter((lote) => {
      if (!STATUS_LOTES_CONCLUIDOS.has(lote.statusProcessamento)) return false;
      if (periodo && formatarPeriodoAnoMes(lote.dataEntrada) !== periodo) return false;
      return true;
    });

    const lotesInput: LoteEficienciaInput[] = lotesConcluidos.map((lote) => {
      const infoMov = movsPorLote.get(lote.id);
      const dataConclusao = infoMov?.ultimaDataHora ?? lote.updatedAt;
      return {
        id: lote.id,
        dataEntrada: lote.dataEntrada,
        dataConclusao,
        responsaveis: infoMov?.responsaveis ?? [],
      };
    });

    const resultado = AnalyticsRules.calcularEstatisticasEficiencia(lotesInput, dataReferencia);

    await AnalyticsRepository.saveHistory({
      metricType: MetricType.OPERATIONAL_EFFICIENCY,
      dimension: periodo ?? 'GLOBAL',
      payload: {
        totalAnalisado: resultado.totalAnalisado,
        tempoMedioHoras: resultado.tempoMedioHoras,
        medianaHoras: resultado.medianaHoras,
        desvioPadraoHoras: resultado.desvioPadraoHoras,
        gargalosPorPeriodo: resultado.gargalosPorPeriodo,
        gargalosPorOperador: resultado.gargalosPorOperador,
        calculadoEm: resultado.calculadoEm.toISOString(),
      },
      calculatedAt: resultado.calculadoEm,
    });

    return resultado;
  }

  /**
   * RF02 + RF04 — Calcula rentabilidade estimada por estado físico, marca e modelo
   * e persiste o snapshot em AnalyticsHistory (metricType = PROFITABILITY).
   */
  static async gerarAnaliseRentabilidade(
    filtros: EquipamentoAnaliseFilter = {},
    dataReferencia: Date = new Date(),
  ): Promise<RentabilidadeAnaliseResult> {
    const equipamentos = await AnalyticsRepository.findEquipamentosParaAnalise(filtros);
    const resultado = AnalyticsRules.calcularRentabilidadeEquipamentos(
      equipamentos,
      dataReferencia,
    );

    const dimension =
      filtros.tipo ?? filtros.organizacaoId ?? filtros.marca ?? 'GLOBAL';

    await AnalyticsRepository.saveHistory({
      metricType: MetricType.PROFITABILITY,
      dimension,
      payload: {
        totalAnalisado: resultado.totalAnalisado,
        valorTotalGeral: resultado.valorTotalGeral,
        valorMedioGeral: resultado.valorMedioGeral,
        itens: resultado.itens,
        calculadoEm: resultado.calculadoEm.toISOString(),
      },
      calculatedAt: resultado.calculadoEm,
    });

    return resultado;
  }

  /**
   * RF03 + RF04 — Executa regressão linear simples (OLS) para estimar a Vida Útil Remanescente (RUL)
   * de um tipo/marca/modelo de equipamento e persiste a predição em EquipmentRULPrediction.
   */
  static async preverVidaUtilRemanescente(
    tipoEquipamento: TipoEquipamento,
    marca: string,
    modelo: string,
    dataReferencia: Date = new Date(),
  ): Promise<RulPredictionResult> {
    const equipamentos = await AnalyticsRepository.findEquipamentosParaAnalise({
      tipo: tipoEquipamento,
      marca,
      modelo,
    });

    const regressao = AnalyticsRules.calcularRegressaoRul(equipamentos, dataReferencia);

    const registro = await AnalyticsRepository.saveRulPrediction({
      tipoEquipamento,
      marca,
      modelo,
      slope: regressao.slope,
      intercept: regressao.intercept,
      estimatedDaysLeft: regressao.estimatedDaysLeft,
      predictedEndDate: regressao.predictedEndDate,
    });

    return {
      ...regressao,
      id: registro.id,
      tipoEquipamento: registro.tipoEquipamento,
      marca: registro.marca,
      modelo: registro.modelo,
      createdAt: registro.createdAt,
    };
  }

  static async consultarHistorico(
    metricType: MetricType,
    limit?: number,
  ): Promise<AnalyticsHistoryRecord[]> {
    return AnalyticsRepository.findHistoryByType(metricType, limit);
  }

  static async consultarPredicoesRul(
    filters: RulPredictionFilter = {},
  ): Promise<EquipmentRULPredictionRecord[]> {
    return AnalyticsRepository.findRulPredictions(filters);
  }
}
