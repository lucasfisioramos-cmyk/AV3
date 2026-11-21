import { describe, expect, it } from 'vitest';
import { AnalyticsService } from '../../../../src/domain/analytics/analytics.service.js';
import {
  EstadoFisico,
  MetricType,
  StatusLote,
  StatusRastreamento,
  TipoEquipamento,
} from '../../../../src/domain/shared/enums.js';
import { RegraDeNegocioError } from '../../../../src/errors/app-error.js';
import { db } from '../../../helpers/fakes.js';

describe('AnalyticsService', () => {
  it('gerarAnaliseEficiencia: calcula métricas de lotes concluídos e persiste snapshot em AnalyticsHistory', async () => {
    const org = await db.semear.organizacao();

    // Lote 1: concluído (TRIAGEM_CONCLUIDA), 4 horas entre entrada e movimentação final
    const entrada1 = new Date('2026-10-10T08:00:00.000Z');
    const conclusao1 = new Date('2026-10-10T12:00:00.000Z');
    const lote1 = await db.semear.lote(org.id, {
      notaFiscal: 'NF-EF-001',
      dataEntrada: entrada1,
      statusProcessamento: StatusLote.TRIAGEM_CONCLUIDA,
    });
    const eq1 = await db.semear.equipamento(lote1.id);
    await db.equipamentoRepository.registrarMovimentacao({
      equipamentoId: eq1.id,
      origem: 'Recebimento',
      destino: 'Bancada Triagem',
      responsavel: 'operador.ana',
      dataHora: conclusao1,
    });

    // Lote 2: concluído (FINALIZADO), 8 horas entre entrada e movimentação final
    const entrada2 = new Date('2026-10-12T08:00:00.000Z');
    const conclusao2 = new Date('2026-10-12T16:00:00.000Z');
    const lote2 = await db.semear.lote(org.id, {
      notaFiscal: 'NF-EF-002',
      dataEntrada: entrada2,
      statusProcessamento: StatusLote.FINALIZADO,
    });
    const eq2 = await db.semear.equipamento(lote2.id);
    await db.equipamentoRepository.registrarMovimentacao({
      equipamentoId: eq2.id,
      origem: 'Triagem',
      destino: 'Expedição',
      responsavel: 'operador.bruno',
      dataHora: conclusao2,
    });

    // Lote 3: ainda RECEBIDO (não deve entrar no cálculo de lotes concluídos)
    await db.semear.lote(org.id, {
      notaFiscal: 'NF-EF-003',
      dataEntrada: new Date('2026-10-15T08:00:00.000Z'),
      statusProcessamento: StatusLote.RECEBIDO,
    });

    const ref = new Date('2026-11-21T12:00:00.000Z');
    const resultado = await AnalyticsService.gerarAnaliseEficiencia(undefined, ref);

    expect(resultado.totalAnalisado).toBe(2);
    expect(resultado.tempoMedioHoras).toBe(6);
    expect(resultado.medianaHoras).toBe(6);
    expect(resultado.desvioPadraoHoras).toBe(2);
    expect(resultado.gargalosPorOperador).toEqual([
      { responsavel: 'operador.bruno', totalLotes: 1, tempoMedioHoras: 8 },
      { responsavel: 'operador.ana', totalLotes: 1, tempoMedioHoras: 4 },
    ]);

    const historico = await AnalyticsService.consultarHistorico(
      MetricType.OPERATIONAL_EFFICIENCY,
    );
    expect(historico).toHaveLength(1);
    expect(historico[0]?.dimension).toBe('GLOBAL');
    expect(historico[0]?.payload).toMatchObject({
      totalAnalisado: 2,
      tempoMedioHoras: 6,
      medianaHoras: 6,
      desvioPadraoHoras: 2,
    });
  });

  it('gerarAnaliseEficiencia: filtra por período (YYYY-MM) e registra a dimensão correspondente', async () => {
    const org = await db.semear.organizacao();
    const loteOut = await db.semear.lote(org.id, {
      notaFiscal: 'NF-OUT',
      dataEntrada: new Date('2026-10-05T10:00:00.000Z'),
      statusProcessamento: StatusLote.FINALIZADO,
    });
    const eqOut = await db.semear.equipamento(loteOut.id);
    await db.equipamentoRepository.registrarMovimentacao({
      equipamentoId: eqOut.id,
      origem: 'A',
      destino: 'B',
      responsavel: 'op1',
      dataHora: new Date('2026-10-05T15:00:00.000Z'),
    });

    const resultadoNov = await AnalyticsService.gerarAnaliseEficiencia('2026-11');
    expect(resultadoNov.totalAnalisado).toBe(0);

    const historico = await AnalyticsService.consultarHistorico(
      MetricType.OPERATIONAL_EFFICIENCY,
    );
    expect(historico[0]?.dimension).toBe('2026-11');
  });

  it('gerarAnaliseRentabilidade: calcula recuperação financeira e persiste snapshot PROFITABILITY', async () => {
    const org = await db.semear.organizacao();
    const lote = await db.semear.lote(org.id);

    await db.semear.equipamento(lote.id, {
      tipo: TipoEquipamento.NOTEBOOK,
      marca: 'Dell',
      modelo: 'Latitude 7420',
      estadoFisico: EstadoFisico.NOVO,
      pesoQuilogramas: 2,
      statusRastreamento: StatusRastreamento.PECAS_REAPROVEITADAS,
    });
    await db.semear.equipamento(lote.id, {
      tipo: TipoEquipamento.SERVIDOR,
      marca: 'Dell',
      modelo: 'PowerEdge R740',
      estadoFisico: EstadoFisico.BOM_ESTADO,
      pesoQuilogramas: 15,
      statusRastreamento: StatusRastreamento.PECAS_REAPROVEITADAS,
    });

    const resultado = await AnalyticsService.gerarAnaliseRentabilidade();

    expect(resultado.totalAnalisado).toBe(2);
    expect(resultado.itens).toHaveLength(2);
    expect(resultado.itens[0]?.modelo).toBe('PowerEdge R740');
    expect(resultado.itens[0]?.valorMedioEstimado).toBeGreaterThan(
      resultado.itens[1]!.valorMedioEstimado,
    );

    const historico = await AnalyticsService.consultarHistorico(MetricType.PROFITABILITY);
    expect(historico).toHaveLength(1);
    expect(historico[0]?.dimension).toBe('GLOBAL');
    expect(historico[0]?.payload).toMatchObject({
      totalAnalisado: 2,
    });
  });

  it('preverVidaUtilRemanescente: executa OLS, persiste em EquipmentRULPrediction e permite consulta filtrada', async () => {
    const org = await db.semear.organizacao();
    const lote = await db.semear.lote(org.id);

    await db.semear.equipamento(lote.id, {
      tipo: TipoEquipamento.NOTEBOOK,
      marca: 'Lenovo',
      modelo: 'ThinkPad T14',
      anoFabricacao: 2025,
      estadoFisico: EstadoFisico.NOVO,
    });
    await db.semear.equipamento(lote.id, {
      tipo: TipoEquipamento.NOTEBOOK,
      marca: 'Lenovo',
      modelo: 'ThinkPad T14',
      anoFabricacao: 2023,
      estadoFisico: EstadoFisico.USADO_MODERADO,
    });
    await db.semear.equipamento(lote.id, {
      tipo: TipoEquipamento.NOTEBOOK,
      marca: 'Lenovo',
      modelo: 'ThinkPad T14',
      anoFabricacao: 2021,
      estadoFisico: EstadoFisico.DANIFICADO_GRAVE,
    });

    const predicao = await AnalyticsService.preverVidaUtilRemanescente(
      TipoEquipamento.NOTEBOOK,
      'Lenovo',
      'ThinkPad T14',
      new Date('2026-06-01T00:00:00.000Z'),
    );

    expect(predicao.id).toBeDefined();
    expect(predicao.tipoEquipamento).toBe(TipoEquipamento.NOTEBOOK);
    expect(predicao.marca).toBe('Lenovo');
    expect(predicao.modelo).toBe('ThinkPad T14');
    expect(predicao.slope).toBeLessThan(0);
    expect(predicao.estimatedDaysLeft).toBeGreaterThan(0);
    expect(predicao.predictedEndDate).toBeInstanceOf(Date);

    const predicoesSalvas = await AnalyticsService.consultarPredicoesRul({
      marca: 'Lenovo',
      modelo: 'ThinkPad T14',
    });
    expect(predicoesSalvas).toHaveLength(1);
    expect(predicoesSalvas[0]?.id).toBe(predicao.id);
  });

  it('preverVidaUtilRemanescente: lança RegraDeNegocioError e não grava registro quando amostra é insuficiente', async () => {
    await expect(
      AnalyticsService.preverVidaUtilRemanescente(
        TipoEquipamento.MONITOR,
        'Samsung',
        'Odyssey',
      ),
    ).rejects.toBeInstanceOf(RegraDeNegocioError);

    const predicoesSalvas = await AnalyticsService.consultarPredicoesRul({
      marca: 'Samsung',
    });
    expect(predicoesSalvas).toHaveLength(0);
  });
});
