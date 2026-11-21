import { rm } from 'node:fs/promises';
import { afterAll, describe, expect, it } from 'vitest';
import { ApiKeyService } from '../../../../src/domain/apikey/api-key.service.js';
import { ReportJobService } from '../../../../src/domain/report/report-job.service.js';
import {
  MetricType,
  ReportFormat,
  ReportJobStatus,
} from '../../../../src/domain/shared/enums.js';
import { NotFoundError, RegraDeNegocioError } from '../../../../src/errors/app-error.js';
import { DEFAULT_BULLMQ_JOB_OPTIONS } from '../../../../src/infrastructure/queue/queues.js';
import { triggerScheduledAnalyticsRun } from '../../../../src/infrastructure/queue/scheduler.js';
import {
  handleReportExportJobFailed,
  processAnalyticsScheduledJob,
  processReportExportJob,
} from '../../../../src/infrastructure/queue/workers.js';
import { db } from '../../../helpers/fakes.js';

const arquivosGerados: string[] = [];

afterAll(async () => {
  await Promise.allSettled(
    arquivosGerados.map((filePath) => rm(filePath, { force: true })),
  );
});

describe('ReportJobService, Workers e Scheduler', () => {
  it('Possui política explícita de retry exponencial (attempts: 3, delay: 5000ms)', () => {
    expect(DEFAULT_BULLMQ_JOB_OPTIONS).toEqual({
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    });
  });

  it('solicitarRelatorio: cria ReportJob PENDING, enfileira no BullMQ e vincula bullJobId', async () => {
    const { apiKey } = await ApiKeyService.gerarChave({
      partnerName: 'Parceiro Relatórios',
      scopes: ['read:reports'],
    });

    const job = await ReportJobService.solicitarRelatorio(apiKey.id, {
      reportType: 'EFFICIENCY',
      format: ReportFormat.CSV,
    });

    expect(job.status).toBe(ReportJobStatus.PENDING);
    expect(job.bullJobId).toBe(`bull-report-${job.id}`);
    expect(db.enqueuedReports).toHaveLength(1);
    expect(db.enqueuedReports[0]).toMatchObject({
      reportJobId: job.id,
      apiKeyId: apiKey.id,
      reportType: 'EFFICIENCY',
      format: 'CSV',
    });
  });

  it('solicitarRelatorio: rejeita reportType inválido com RegraDeNegocioError', async () => {
    const { apiKey } = await ApiKeyService.gerarChave({
      partnerName: 'Parceiro Erro',
      scopes: ['read:reports'],
    });

    await expect(
      ReportJobService.solicitarRelatorio(apiKey.id, {
        reportType: 'TIPO_INEXISTENTE',
        format: ReportFormat.JSON,
      }),
    ).rejects.toBeInstanceOf(RegraDeNegocioError);
  });

  it('consultarRelatorio: impede que um parceiro acesse o ReportJob de outro parceiro (404 NotFoundError)', async () => {
    const p1 = await ApiKeyService.gerarChave({
      partnerName: 'Parceiro 1',
      scopes: ['read:reports'],
    });
    const p2 = await ApiKeyService.gerarChave({
      partnerName: 'Parceiro 2',
      scopes: ['read:reports'],
    });

    const jobP1 = await ReportJobService.solicitarRelatorio(p1.apiKey.id, {
      reportType: 'PROFITABILITY',
      format: ReportFormat.JSON,
    });

    await expect(
      ReportJobService.consultarRelatorio(p2.apiKey.id, jobP1.id),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('processReportExportJob: processa o job, gera arquivo físico e atualiza status para COMPLETED', async () => {
    const { apiKey } = await ApiKeyService.gerarChave({
      partnerName: 'Parceiro Worker',
      scopes: ['read:reports'],
    });

    const job = await ReportJobService.solicitarRelatorio(apiKey.id, {
      reportType: 'PROFITABILITY',
      format: ReportFormat.CSV,
    });

    const concluido = await processReportExportJob(db.enqueuedReports[0]!);
    if (concluido.filePath) arquivosGerados.push(concluido.filePath);

    expect(concluido.status).toBe(ReportJobStatus.COMPLETED);
    expect(concluido.filePath).toBeTruthy();
    expect(concluido.completedAt).toBeInstanceOf(Date);

    const download = await ReportJobService.obterArquivoRelatorio(apiKey.id, job.id);
    expect(download.contentType).toContain('text/csv');
    expect(download.content).toContain('totalAnalisado');
  });

  it('handleReportExportJobFailed: marca como FAILED apenas quando esgota as 3 tentativas', async () => {
    const { apiKey } = await ApiKeyService.gerarChave({
      partnerName: 'Parceiro Falha',
      scopes: ['read:reports'],
    });

    const job = await ReportJobService.solicitarRelatorio(apiKey.id, {
      reportType: 'TRACEABILITY',
      format: ReportFormat.JSON,
    });
    const payload = db.enqueuedReports[0]!;

    // 1ª tentativa falhou (ainda restam retentativas): não deve marcar FAILED definitivo
    await handleReportExportJobFailed(
      { data: payload, attemptsMade: 1, opts: { attempts: 3 } },
      new Error('Erro transitório de IO'),
    );
    expect((await ReportJobService.consultarRelatorio(apiKey.id, job.id)).status).toBe(
      ReportJobStatus.PENDING,
    );

    // 3ª tentativa falhou (esgotou attempts = 3): marca FAILED com errorReason
    await handleReportExportJobFailed(
      { data: payload, attemptsMade: 3, opts: { attempts: 3 } },
      new Error('Disco cheio após 3 tentativas'),
    );

    const falho = await ReportJobService.consultarRelatorio(apiKey.id, job.id);
    expect(falho.status).toBe(ReportJobStatus.FAILED);
    expect(falho.errorReason).toBe('Disco cheio após 3 tentativas');
    expect(falho.completedAt).toBeInstanceOf(Date);
  });

  it('Scheduler e AnalyticsWorker: enfileira e processa recálculo diário de eficiência e rentabilidade', async () => {
    const enqueued = await triggerScheduledAnalyticsRun('cron');
    expect(enqueued.bullJobId).toBeDefined();
    expect(db.enqueuedAnalytics).toHaveLength(1);
    expect(db.enqueuedAnalytics[0]?.triggeredBy).toBe('cron');

    await processAnalyticsScheduledJob(db.enqueuedAnalytics[0]!);

    expect(
      await db.analyticsRepository.findHistoryByType(MetricType.OPERATIONAL_EFFICIENCY),
    ).toHaveLength(1);
    expect(
      await db.analyticsRepository.findHistoryByType(MetricType.PROFITABILITY),
    ).toHaveLength(1);
  });
});
