import { describe, expect, it } from 'vitest';
import { AnalyticsRules } from '../../../../src/domain/analytics/analytics.rules.js';
import { EstadoFisico, TipoEquipamento } from '../../../../src/domain/shared/enums.js';
import { RegraDeNegocioError } from '../../../../src/errors/app-error.js';

describe('AnalyticsRules', () => {
  describe('RF01 — calcularEstatisticasEficiencia', () => {
    it('retorna métricas zeradas quando a amostra está vazia (sem lançar erro)', () => {
      const ref = new Date('2026-11-21T12:00:00.000Z');
      const resultado = AnalyticsRules.calcularEstatisticasEficiencia([], ref);

      expect(resultado).toEqual({
        totalAnalisado: 0,
        tempoMedioHoras: 0,
        medianaHoras: 0,
        desvioPadraoHoras: 0,
        gargalosPorPeriodo: [],
        gargalosPorOperador: [],
        calculadoEm: ref,
      });
    });

    it('calcula média, mediana, desvio padrão e gargalos por período e operador com valores conhecidos', () => {
      const ref = new Date('2026-11-21T12:00:00.000Z');
      // Tempos em horas: [2, 4, 6, 12] -> média = 6, mediana = 5, desvio padrão = sqrt(14) ≈ 3.74
      const lotes = [
        {
          id: 'lote-1',
          dataEntrada: new Date('2026-10-10T08:00:00.000Z'),
          dataConclusao: new Date('2026-10-10T10:00:00.000Z'), // 2h
          responsaveis: ['ana', 'ana'],
        },
        {
          id: 'lote-2',
          dataEntrada: new Date('2026-10-15T08:00:00.000Z'),
          dataConclusao: new Date('2026-10-15T12:00:00.000Z'), // 4h
          responsaveis: ['ana', 'carlos'],
        },
        {
          id: 'lote-3',
          dataEntrada: new Date('2026-11-01T08:00:00.000Z'),
          dataConclusao: new Date('2026-11-01T14:00:00.000Z'), // 6h
          responsaveis: ['carlos'],
        },
        {
          id: 'lote-4',
          dataEntrada: new Date('2026-11-05T08:00:00.000Z'),
          dataConclusao: new Date('2026-11-05T20:00:00.000Z'), // 12h
          responsaveis: ['bruno'],
        },
      ];

      const resultado = AnalyticsRules.calcularEstatisticasEficiencia(lotes, ref);

      expect(resultado.totalAnalisado).toBe(4);
      expect(resultado.tempoMedioHoras).toBe(6);
      expect(resultado.medianaHoras).toBe(5);
      expect(resultado.desvioPadraoHoras).toBe(3.74);

      // Período 2026-11 ([6, 12] -> média 9) vem antes de 2026-10 ([2, 4] -> média 3)
      expect(resultado.gargalosPorPeriodo).toEqual([
        {
          periodo: '2026-11',
          totalLotes: 2,
          tempoMedioHoras: 9,
          medianaHoras: 9,
          desvioPadraoHoras: 3,
        },
        {
          periodo: '2026-10',
          totalLotes: 2,
          tempoMedioHoras: 3,
          medianaHoras: 3,
          desvioPadraoHoras: 1,
        },
      ]);

      // Operadores ordenados pelo maior tempo médio: bruno (12h), carlos (mean(4,6)=5h), ana (mean(2,4)=3h)
      expect(resultado.gargalosPorOperador).toEqual([
        { responsavel: 'bruno', totalLotes: 1, tempoMedioHoras: 12 },
        { responsavel: 'carlos', totalLotes: 2, tempoMedioHoras: 5 },
        { responsavel: 'ana', totalLotes: 2, tempoMedioHoras: 3 },
      ]);
    });
  });

  describe('RF02 — calcularRentabilidadeEquipamentos', () => {
    it('retorna métricas zeradas quando não há equipamentos', () => {
      const ref = new Date('2026-11-21T12:00:00.000Z');
      const resultado = AnalyticsRules.calcularRentabilidadeEquipamentos([], ref);

      expect(resultado).toEqual({
        totalAnalisado: 0,
        valorTotalGeral: 0,
        valorMedioGeral: 0,
        itens: [],
        calculadoEm: ref,
      });
    });

    it('agrupa por estadoFisico, marca e modelo e ordena pelo maior valor médio estimado', () => {
      const ref = new Date('2026-11-21T12:00:00.000Z');
      // NOTEBOOK (150) * NOVO (1.0) * 2kg = 300 e 4kg = 600 -> média 450, mediana 450, desvio 150
      // MONITOR (75) * USADO_MODERADO (0.55) * 4kg = 165
      // SERVIDOR (180) * BOM_ESTADO (0.85) * 10kg = 1530
      const equipamentos = [
        {
          tipo: TipoEquipamento.NOTEBOOK,
          marca: 'Dell',
          modelo: 'Latitude 5420',
          estadoFisico: EstadoFisico.NOVO,
          pesoQuilogramas: 2,
        },
        {
          tipo: TipoEquipamento.NOTEBOOK,
          marca: 'Dell',
          modelo: 'Latitude 5420',
          estadoFisico: EstadoFisico.NOVO,
          pesoQuilogramas: 4,
        },
        {
          tipo: TipoEquipamento.MONITOR,
          marca: 'LG',
          modelo: 'UltraWide',
          estadoFisico: EstadoFisico.USADO_MODERADO,
          pesoQuilogramas: 4,
        },
        {
          tipo: TipoEquipamento.SERVIDOR,
          marca: 'HP',
          modelo: 'ProLiant DL380',
          estadoFisico: EstadoFisico.BOM_ESTADO,
          pesoQuilogramas: 10,
        },
      ];

      const resultado = AnalyticsRules.calcularRentabilidadeEquipamentos(equipamentos, ref);

      expect(resultado.totalAnalisado).toBe(4);
      expect(resultado.valorTotalGeral).toBe(2595); // 300 + 600 + 165 + 1530
      expect(resultado.valorMedioGeral).toBe(648.75);
      expect(resultado.itens).toHaveLength(3);

      // Ordenado por valorMedioEstimado decrescente: HP ProLiant (1530) -> Dell Latitude (450) -> LG UltraWide (165)
      expect(resultado.itens[0]).toEqual({
        estadoFisico: EstadoFisico.BOM_ESTADO,
        marca: 'HP',
        modelo: 'ProLiant DL380',
        quantidade: 1,
        pesoTotalKg: 10,
        valorTotalEstimado: 1530,
        valorMedioEstimado: 1530,
        medianaValorEstimado: 1530,
        desvioPadraoValorEstimado: 0,
      });
      expect(resultado.itens[1]).toEqual({
        estadoFisico: EstadoFisico.NOVO,
        marca: 'Dell',
        modelo: 'Latitude 5420',
        quantidade: 2,
        pesoTotalKg: 6,
        valorTotalEstimado: 900,
        valorMedioEstimado: 450,
        medianaValorEstimado: 450,
        desvioPadraoValorEstimado: 150,
      });
      expect(resultado.itens[2]?.marca).toBe('LG');
      expect(resultado.itens[2]?.valorMedioEstimado).toBe(165);
    });
  });

  describe('RF03 — calcularRegressaoRul (Regressão Linear Simples OLS)', () => {
    it('calcula slope, intercept, estimatedDaysLeft e predictedEndDate exatos para reta conhecida', () => {
      const ref = new Date('2026-01-01T00:00:00.000Z');
      // Reta exata: y = -1 * x + 110
      // Ponto 1: x = 10 dias (2025-12-22), y = 100 (NOVO)
      // Ponto 2: x = 40 dias (2025-11-22), y = 70 (USADO_LEVE)
      // Ponto 3: x = 60 dias (2025-11-02), y = 50 (USADO_MODERADO)
      const amostras = [
        {
          anoFabricacao: 2025,
          dataFabricacao: new Date('2025-12-22T00:00:00.000Z'),
          estadoFisico: EstadoFisico.NOVO,
        },
        {
          anoFabricacao: 2025,
          dataFabricacao: new Date('2025-11-22T00:00:00.000Z'),
          estadoFisico: EstadoFisico.USADO_LEVE,
        },
        {
          anoFabricacao: 2025,
          dataFabricacao: new Date('2025-11-02T00:00:00.000Z'),
          estadoFisico: EstadoFisico.USADO_MODERADO,
        },
      ];

      const rul = AnalyticsRules.calcularRegressaoRul(amostras, ref);

      expect(rul.totalAmostras).toBe(3);
      expect(rul.slope).toBe(-1);
      expect(rul.intercept).toBe(110);
      expect(rul.idadeAtualMediaDias).toBe(36.67);
      // Fim de vida em y = 10 -> x = (10 - 110) / -1 = 100 dias
      // Dias restantes = round(100 - 36.6667) = 63 dias
      expect(rul.estimatedDaysLeft).toBe(63);
      expect(rul.predictedEndDate.toISOString()).toBe('2026-03-05T00:00:00.000Z');
    });

    it('calcula idade a partir de anoFabricacao quando dataFabricacao não é informada', () => {
      const ref = new Date('2026-01-01T00:00:00.000Z');
      const amostras = [
        { anoFabricacao: 2025, estadoFisico: EstadoFisico.NOVO }, // 365 dias, y=100
        { anoFabricacao: 2023, estadoFisico: EstadoFisico.USADO_MODERADO }, // 1096 dias, y=50
        { anoFabricacao: 2021, estadoFisico: EstadoFisico.DANIFICADO_GRAVE }, // 1826 dias, y=15
      ];

      const rul = AnalyticsRules.calcularRegressaoRul(amostras, ref);

      expect(rul.slope).toBeLessThan(0);
      expect(rul.intercept).toBeGreaterThan(100);
      expect(rul.estimatedDaysLeft).toBeGreaterThan(0);
    });

    it('lança RegraDeNegocioError quando há menos de 2 amostras', () => {
      expect(() =>
        AnalyticsRules.calcularRegressaoRul([
          { anoFabricacao: 2024, estadoFisico: EstadoFisico.BOM_ESTADO },
        ]),
      ).toThrowError(RegraDeNegocioError);
    });

    it('lança RegraDeNegocioError quando não há variação temporal (idades idênticas)', () => {
      expect(() =>
        AnalyticsRules.calcularRegressaoRul([
          { anoFabricacao: 2023, estadoFisico: EstadoFisico.NOVO },
          { anoFabricacao: 2023, estadoFisico: EstadoFisico.DANIFICADO_LEVE },
        ]),
      ).toThrowError(RegraDeNegocioError);
    });

    it('lança RegraDeNegocioError quando slope >= 0 (sem tendência de degradação)', () => {
      // Equipamento mais velho (2020) com saúde maior (NOVO=100) que o mais novo (2025, DANIFICADO_GRAVE=15) -> slope > 0
      expect(() =>
        AnalyticsRules.calcularRegressaoRul([
          { anoFabricacao: 2025, estadoFisico: EstadoFisico.DANIFICADO_GRAVE },
          { anoFabricacao: 2020, estadoFisico: EstadoFisico.NOVO },
        ]),
      ).toThrowError(RegraDeNegocioError);
    });
  });
});
