import {
  linearRegression,
  linearRegressionLine,
  mean,
  median,
  standardDeviation,
} from 'simple-statistics';
import { RegraDeNegocioError } from '../../errors/app-error.js';
import { EstadoFisico, TipoEquipamento } from '../shared/enums.js';
import type {
  AmostraRulInput,
  EficienciaOperacionalResult,
  EquipamentoRentabilidadeInput,
  GargaloOperadorItem,
  GargaloPeriodoItem,
  LoteEficienciaInput,
  RentabilidadeAnaliseResult,
  RentabilidadeItem,
  RulRegressionOutput,
} from './analytics.types.js';

const MS_POR_HORA = 1000 * 60 * 60;
const MS_POR_DIA = MS_POR_HORA * 24;
export const LIMIAR_SAUDE_INSERVIVEL = 10;

export const VALOR_BASE_POR_KG_EQUIPAMENTO: Record<TipoEquipamento, number> = {
  [TipoEquipamento.SERVIDOR]: 180,
  [TipoEquipamento.NOTEBOOK]: 150,
  [TipoEquipamento.COMPUTADOR_MESA]: 110,
  [TipoEquipamento.ROTEADOR]: 95,
  [TipoEquipamento.MONITOR]: 75,
  [TipoEquipamento.IMPRESSORA]: 60,
  [TipoEquipamento.FONTE_ALIMENTACAO]: 50,
  [TipoEquipamento.CABO_ESTRUTURADO]: 35,
};

export const MULTIPLICADOR_ESTADO_FISICO: Record<EstadoFisico, number> = {
  [EstadoFisico.NOVO]: 1.0,
  [EstadoFisico.BOM_ESTADO]: 0.85,
  [EstadoFisico.USADO_LEVE]: 0.7,
  [EstadoFisico.USADO_MODERADO]: 0.55,
  [EstadoFisico.DANIFICADO_LEVE]: 0.35,
  [EstadoFisico.DANIFICADO_GRAVE]: 0.2,
  [EstadoFisico.INSERVIVEL]: 0.1,
};

export const INDICE_SAUDE_ESTADO_FISICO: Record<EstadoFisico, number> = {
  [EstadoFisico.NOVO]: 100,
  [EstadoFisico.BOM_ESTADO]: 85,
  [EstadoFisico.USADO_LEVE]: 70,
  [EstadoFisico.USADO_MODERADO]: 50,
  [EstadoFisico.DANIFICADO_LEVE]: 30,
  [EstadoFisico.DANIFICADO_GRAVE]: 15,
  [EstadoFisico.INSERVIVEL]: 0,
};

function arredondar(valor: number, casas = 2): number {
  const fator = 10 ** casas;
  return Math.round(valor * fator) / fator;
}

function formatarPeriodoAnoMes(data: Date): string {
  const ano = data.getUTCFullYear();
  const mes = String(data.getUTCMonth() + 1).padStart(2, '0');
  return `${ano}-${mes}`;
}

export const AnalyticsRules = {
  /**
   * RF01 — Eficiência Operacional:
   * Calcula média, mediana e desvio padrão do tempo de processamento (em horas)
   * de lotes concluídos, além de gargalos agrupados por período (YYYY-MM) e por operador.
   */
  calcularEstatisticasEficiencia(
    lotesConcluidos: LoteEficienciaInput[],
    dataReferencia: Date = new Date(),
  ): EficienciaOperacionalResult {
    if (lotesConcluidos.length === 0) {
      return {
        totalAnalisado: 0,
        tempoMedioHoras: 0,
        medianaHoras: 0,
        desvioPadraoHoras: 0,
        gargalosPorPeriodo: [],
        gargalosPorOperador: [],
        calculadoEm: dataReferencia,
      };
    }

    const duracoesGerais: number[] = [];
    const porPeriodo = new Map<string, number[]>();
    const porOperador = new Map<string, number[]>();

    for (const lote of lotesConcluidos) {
      const diffMs = lote.dataConclusao.getTime() - lote.dataEntrada.getTime();
      const horas = Math.max(0, diffMs / MS_POR_HORA);
      duracoesGerais.push(horas);

      const periodo = formatarPeriodoAnoMes(lote.dataEntrada);
      const listaPeriodo = porPeriodo.get(periodo) ?? [];
      listaPeriodo.push(horas);
      porPeriodo.set(periodo, listaPeriodo);

      const operadoresUnicos = new Set(
        (lote.responsaveis ?? []).map((r) => r.trim()).filter((r) => r.length > 0),
      );
      for (const responsavel of operadoresUnicos) {
        const listaOp = porOperador.get(responsavel) ?? [];
        listaOp.push(horas);
        porOperador.set(responsavel, listaOp);
      }
    }

    const gargalosPorPeriodo: GargaloPeriodoItem[] = [...porPeriodo.entries()]
      .map(([periodo, tempos]) => ({
        periodo,
        totalLotes: tempos.length,
        tempoMedioHoras: arredondar(mean(tempos)),
        medianaHoras: arredondar(median(tempos)),
        desvioPadraoHoras: arredondar(standardDeviation(tempos)),
      }))
      .sort(
        (a, b) =>
          b.tempoMedioHoras - a.tempoMedioHoras || a.periodo.localeCompare(b.periodo),
      );

    const gargalosPorOperador: GargaloOperadorItem[] = [...porOperador.entries()]
      .map(([responsavel, tempos]) => ({
        responsavel,
        totalLotes: tempos.length,
        tempoMedioHoras: arredondar(mean(tempos)),
      }))
      .sort(
        (a, b) =>
          b.tempoMedioHoras - a.tempoMedioHoras ||
          a.responsavel.localeCompare(b.responsavel),
      );

    return {
      totalAnalisado: duracoesGerais.length,
      tempoMedioHoras: arredondar(mean(duracoesGerais)),
      medianaHoras: arredondar(median(duracoesGerais)),
      desvioPadraoHoras: arredondar(standardDeviation(duracoesGerais)),
      gargalosPorPeriodo,
      gargalosPorOperador,
      calculadoEm: dataReferencia,
    };
  },

  /**
   * Calcula o valor financeiro estimado de recuperação de um único equipamento.
   */
  calcularValorEstimadoEquipamento(equipamento: EquipamentoRentabilidadeInput): number {
    const valorBase = VALOR_BASE_POR_KG_EQUIPAMENTO[equipamento.tipo] ?? 50;
    const multiplicador = MULTIPLICADOR_ESTADO_FISICO[equipamento.estadoFisico] ?? 0.1;
    const peso = Math.max(0, equipamento.pesoQuilogramas);
    return valorBase * multiplicador * peso;
  },

  /**
   * RF02 — Rentabilidade por Equipamento:
   * Agrupa equipamentos por (estadoFisico, marca, modelo), calcula estatísticas
   * de valor financeiro estimado e ordena do maior valor médio para o menor.
   */
  calcularRentabilidadeEquipamentos(
    equipamentos: EquipamentoRentabilidadeInput[],
    dataReferencia: Date = new Date(),
  ): RentabilidadeAnaliseResult {
    if (equipamentos.length === 0) {
      return {
        totalAnalisado: 0,
        valorTotalGeral: 0,
        valorMedioGeral: 0,
        itens: [],
        calculadoEm: dataReferencia,
      };
    }

    interface GrupoAcumulador {
      estadoFisico: EstadoFisico;
      marca: string;
      modelo: string;
      pesoTotalKg: number;
      valores: number[];
    }

    const grupos = new Map<string, GrupoAcumulador>();
    const todosValores: number[] = [];

    for (const eq of equipamentos) {
      const valor = this.calcularValorEstimadoEquipamento(eq);
      todosValores.push(valor);

      const chave = `${eq.estadoFisico}::${eq.marca}::${eq.modelo}`;
      const existente = grupos.get(chave);
      if (existente) {
        existente.pesoTotalKg += Math.max(0, eq.pesoQuilogramas);
        existente.valores.push(valor);
      } else {
        grupos.set(chave, {
          estadoFisico: eq.estadoFisico,
          marca: eq.marca,
          modelo: eq.modelo,
          pesoTotalKg: Math.max(0, eq.pesoQuilogramas),
          valores: [valor],
        });
      }
    }

    const itens: RentabilidadeItem[] = [...grupos.values()]
      .map((g) => {
        const soma = g.valores.reduce((acc, v) => acc + v, 0);
        return {
          estadoFisico: g.estadoFisico,
          marca: g.marca,
          modelo: g.modelo,
          quantidade: g.valores.length,
          pesoTotalKg: arredondar(g.pesoTotalKg),
          valorTotalEstimado: arredondar(soma),
          valorMedioEstimado: arredondar(mean(g.valores)),
          medianaValorEstimado: arredondar(median(g.valores)),
          desvioPadraoValorEstimado: arredondar(standardDeviation(g.valores)),
        };
      })
      .sort(
        (a, b) =>
          b.valorMedioEstimado - a.valorMedioEstimado ||
          b.valorTotalEstimado - a.valorTotalEstimado ||
          a.marca.localeCompare(b.marca) ||
          a.modelo.localeCompare(b.modelo),
      );

    const somaGeral = todosValores.reduce((acc, v) => acc + v, 0);

    return {
      totalAnalisado: equipamentos.length,
      valorTotalGeral: arredondar(somaGeral),
      valorMedioGeral: arredondar(mean(todosValores)),
      itens,
      calculadoEm: dataReferencia,
    };
  },

  /**
   * RF03 — Análise Preditiva de Vida Útil Remanescente (RUL) via Regressão Linear Simples (OLS):
   * Relaciona idade do equipamento em dias (X) com o índice de saúde física 0..100 (Y).
   * Lança RegraDeNegocioError se houver menos de 2 pontos, ausência de variação temporal
   * ou coeficiente angular (slope) >= 0 (sem tendência de degradação).
   */
  calcularRegressaoRul(
    amostras: AmostraRulInput[],
    dataReferencia: Date = new Date(),
  ): RulRegressionOutput {
    if (amostras.length < 2) {
      throw new RegraDeNegocioError(
        'Amostra insuficiente para predição RUL: são necessários no mínimo 2 equipamentos.',
      );
    }

    const pontos: [number, number][] = amostras.map((amostra) => {
      const dataFab =
        amostra.dataFabricacao ?? new Date(Date.UTC(amostra.anoFabricacao, 0, 1));
      const idadeDias = Math.max(
        0,
        Math.round((dataReferencia.getTime() - dataFab.getTime()) / MS_POR_DIA),
      );
      const saude = INDICE_SAUDE_ESTADO_FISICO[amostra.estadoFisico] ?? 0;
      return [idadeDias, saude];
    });

    const idadesDistintas = new Set(pontos.map(([x]) => x));
    if (idadesDistintas.size < 2) {
      throw new RegraDeNegocioError(
        'Amostra insuficiente para predição RUL: não há variação temporal (idades idênticas) para regressão linear.',
      );
    }

    const mb = linearRegression(pontos);
    const linha = linearRegressionLine(mb);
    const { m: slope, b: intercept } = mb;

    if (!Number.isFinite(slope) || !Number.isFinite(intercept) || slope >= 0) {
      throw new RegraDeNegocioError(
        'Não foi possível estimar a vida útil remanescente: a amostra não apresenta tendência de degradação mensurável (slope >= 0).',
      );
    }

    const idades = pontos.map(([x]) => x);
    const saudes = pontos.map(([, y]) => y);
    const idadeAtualMediaDias = mean(idades);
    const indiceSaudeMedioAtual = mean(saudes);
    const indiceSaudeProjetadoAtual = linha(idadeAtualMediaDias);

    const idadeFimVida = (LIMIAR_SAUDE_INSERVIVEL - intercept) / slope;
    const estimatedDaysLeft = Math.max(
      0,
      Math.round(idadeFimVida - idadeAtualMediaDias),
    );
    const predictedEndDate = new Date(
      dataReferencia.getTime() + estimatedDaysLeft * MS_POR_DIA,
    );

    return {
      totalAmostras: amostras.length,
      slope: arredondar(slope, 6),
      intercept: arredondar(intercept, 4),
      idadeAtualMediaDias: arredondar(idadeAtualMediaDias, 2),
      indiceSaudeMedioAtual: arredondar(indiceSaudeMedioAtual, 2),
      indiceSaudeProjetadoAtual: arredondar(indiceSaudeProjetadoAtual, 2),
      estimatedDaysLeft,
      predictedEndDate,
    };
  },
};
