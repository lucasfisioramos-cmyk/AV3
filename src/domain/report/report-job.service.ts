import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../../config/env.js';
import { NotFoundError, RegraDeNegocioError } from '../../errors/app-error.js';
import {
  QueueDispatcher,
  REPORT_TYPES,
  type ReportExportJobPayload,
  type ReportType,
} from '../../infrastructure/queue/queues.js';
import { ReportExporter } from '../../infrastructure/queue/report-exporter.js';
import {
  ReportJobRepository,
  type ReportJobRecord,
} from '../../persistence/report-job.repository.js';
import { AnalyticsService } from '../analytics/analytics.service.js';
import { EquipamentoService } from '../equipamento/equipamento.service.js';
import { ReportFormat, ReportJobStatus } from '../shared/enums.js';

export interface SolicitarRelatorioInput {
  reportType: ReportType | string;
  format: ReportFormat;
  filters?: Record<string, unknown>;
}

const REPORT_TYPES_SET = new Set<string>(REPORT_TYPES);
const REPORT_FORMATS_SET = new Set<string>([ReportFormat.CSV, ReportFormat.JSON]);

export class ReportJobService {
  /**
   * RF09 — Registra um novo ReportJob com status PENDING e enfileira a execução
   * assíncrona no BullMQ (reports-export-queue).
   */
  static async solicitarRelatorio(
    apiKeyId: string,
    input: SolicitarRelatorioInput,
  ): Promise<ReportJobRecord> {
    const reportType = input.reportType?.trim().toUpperCase();
    if (!reportType || !REPORT_TYPES_SET.has(reportType)) {
      throw new RegraDeNegocioError(
        `Tipo de relatório inválido: '${input.reportType}'. Use: ${REPORT_TYPES.join(', ')}.`,
      );
    }

    if (!input.format || !REPORT_FORMATS_SET.has(input.format)) {
      throw new RegraDeNegocioError(
        `Formato de relatório inválido: '${input.format}'. Use CSV ou JSON.`,
      );
    }

    const jobCriado = await ReportJobRepository.create({
      apiKeyId,
      reportType,
      format: input.format,
    });

    const { bullJobId } = await QueueDispatcher.enqueueReportExport({
      reportJobId: jobCriado.id,
      apiKeyId,
      reportType,
      format: input.format,
      filters: input.filters ?? {},
    });

    return ReportJobRepository.attachBullJobId(jobCriado.id, bullJobId);
  }

  /**
   * RF09 — Consulta metadados e status de um ReportJob garantindo isolamento por parceiro (apiKeyId).
   * Se o job não existir ou pertencer a outro parceiro, lança 404 NotFoundError.
   */
  static async consultarRelatorio(
    apiKeyId: string,
    jobId: string,
  ): Promise<ReportJobRecord> {
    const job = await ReportJobRepository.findById(jobId);
    if (!job || job.apiKeyId !== apiKeyId) {
      throw new NotFoundError('Relatório não encontrado.');
    }
    return job;
  }

  /**
   * Lê o conteúdo do arquivo de relatório quando o job já está COMPLETED.
   */
  static async obterArquivoRelatorio(
    apiKeyId: string,
    jobId: string,
  ): Promise<{ job: ReportJobRecord; content: string; contentType: string; fileName: string }> {
    const job = await this.consultarRelatorio(apiKeyId, jobId);

    if (job.status !== ReportJobStatus.COMPLETED || !job.filePath) {
      throw new RegraDeNegocioError(
        `O relatório ainda não está disponível para download (status atual: ${job.status}).`,
      );
    }

    const content = await readFile(job.filePath, 'utf-8');
    const ext = job.format === ReportFormat.CSV ? 'csv' : 'json';
    const contentType =
      job.format === ReportFormat.CSV
        ? 'text/csv; charset=utf-8'
        : 'application/json; charset=utf-8';
    const fileName = `report-${job.reportType.toLowerCase()}-${job.id}.${ext}`;

    return { job, content, contentType, fileName };
  }

  /**
   * Executado pelo Worker do BullMQ: coleta dados do domínio, serializa em CSV ou JSON,
   * grava no disco usando `node:path` e marca o job como COMPLETED.
   */
  static async processarExportacaoRelatorio(
    payload: ReportExportJobPayload,
  ): Promise<ReportJobRecord> {
    await ReportJobRepository.updateStatus(payload.reportJobId, ReportJobStatus.PROCESSING);

    const dados = await this.coletarDadosRelatorio(
      payload.reportType,
      payload.format,
      payload.filters,
    );
    const conteudo = ReportExporter.serialize(dados, payload.format);

    const diretorio = path.resolve(env.REPORTS_DIR);
    await mkdir(diretorio, { recursive: true });

    const extensao = payload.format === ReportFormat.CSV ? 'csv' : 'json';
    const caminhoArquivo = path.join(diretorio, `${payload.reportJobId}.${extensao}`);

    await writeFile(caminhoArquivo, conteudo, 'utf-8');

    return ReportJobRepository.updateStatus(payload.reportJobId, ReportJobStatus.COMPLETED, {
      filePath: caminhoArquivo,
      errorReason: null,
      completedAt: new Date(),
    });
  }

  /**
   * Executado pelo Worker do BullMQ quando todas as tentativas (attempts) se esgotam.
   */
  static async registrarFalhaDefinitiva(
    reportJobId: string,
    errorReason: string,
  ): Promise<ReportJobRecord> {
    return ReportJobRepository.updateStatus(reportJobId, ReportJobStatus.FAILED, {
      errorReason,
      completedAt: new Date(),
    });
  }

  private static async coletarDadosRelatorio(
    reportType: string,
    format: ReportFormat,
    filters?: Record<string, unknown>,
  ): Promise<Record<string, unknown>[] | Record<string, unknown>> {
    const tipo = reportType.toUpperCase();

    if (tipo === 'EFFICIENCY') {
      const periodo = typeof filters?.periodo === 'string' ? filters.periodo : undefined;
      const res = await AnalyticsService.gerarAnaliseEficiencia(periodo);
      if (format === ReportFormat.CSV) {
        return res.gargalosPorPeriodo.length > 0
          ? res.gargalosPorPeriodo.map((g) => ({ ...g }))
          : [
              {
                totalAnalisado: res.totalAnalisado,
                tempoMedioHoras: res.tempoMedioHoras,
                medianaHoras: res.medianaHoras,
                desvioPadraoHoras: res.desvioPadraoHoras,
                calculadoEm: res.calculadoEm.toISOString(),
              },
            ];
      }
      return {
        ...res,
        calculadoEm: res.calculadoEm.toISOString(),
      };
    }

    if (tipo === 'PROFITABILITY') {
      const res = await AnalyticsService.gerarAnaliseRentabilidade();
      if (format === ReportFormat.CSV) {
        return res.itens.length > 0
          ? res.itens.map((i) => ({ ...i }))
          : [
              {
                totalAnalisado: 0,
                valorTotalGeral: 0,
                valorMedioGeral: 0,
              },
            ];
      }
      return {
        ...res,
        calculadoEm: res.calculadoEm.toISOString(),
      };
    }

    if (tipo === 'RUL') {
      const predicoes = await AnalyticsService.consultarPredicoesRul();
      const rows = predicoes.map((p) => ({
        id: p.id,
        tipoEquipamento: p.tipoEquipamento,
        marca: p.marca,
        modelo: p.modelo,
        slope: p.slope,
        intercept: p.intercept,
        estimatedDaysLeft: p.estimatedDaysLeft,
        predictedEndDate: p.predictedEndDate.toISOString(),
        createdAt: p.createdAt.toISOString(),
      }));
      return format === ReportFormat.CSV && rows.length === 0
        ? [{ mensagem: 'Nenhuma predicao RUL registrada' }]
        : rows;
    }

    // TRACEABILITY (padrão)
    const listagem = await EquipamentoService.listarEquipamentos({ page: 1, limit: 100 });
    const rows = listagem.itens.map((e) => ({
      id: e.id,
      codigoBarrasInterno: e.codigoBarrasInterno,
      tipo: e.tipo,
      marca: e.marca,
      modelo: e.modelo,
      anoFabricacao: e.anoFabricacao,
      estadoFisico: e.estadoFisico,
      pesoQuilogramas: e.pesoQuilogramas,
      statusRastreamento: e.statusRastreamento,
      loteId: e.loteId,
    }));
    return format === ReportFormat.CSV && rows.length === 0
      ? [{ mensagem: 'Nenhum equipamento encontrado' }]
      : rows;
  }
}
