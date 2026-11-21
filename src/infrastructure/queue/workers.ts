import { Worker, type Job } from 'bullmq';
import { AnalyticsService } from '../../domain/analytics/analytics.service.js';
import { ReportJobService } from '../../domain/report/report-job.service.js';
import {
  ANALYTICS_SCHEDULED_QUEUE_NAME,
  REPORTS_EXPORT_QUEUE_NAME,
  type AnalyticsScheduledJobPayload,
  type ReportExportJobPayload,
} from './queues.js';
import { createRedisConnection } from './redis.connection.js';

let analyticsWorker: Worker<AnalyticsScheduledJobPayload> | null = null;
let reportsWorker: Worker<ReportExportJobPayload> | null = null;

/**
 * Handler do job agendado de recálculo analítico (delegando para AnalyticsService).
 */
export async function processAnalyticsScheduledJob(
  _payload: AnalyticsScheduledJobPayload,
): Promise<void> {
  await AnalyticsService.gerarAnaliseEficiencia();
  await AnalyticsService.gerarAnaliseRentabilidade();
}

/**
 * Handler do job de exportação de relatório (delegando para ReportJobService).
 */
export async function processReportExportJob(payload: ReportExportJobPayload) {
  return ReportJobService.processarExportacaoRelatorio(payload);
}

/**
 * Handler de falha do worker de relatórios: marca o ReportJob como FAILED
 * apenas após esgotar todas as tentativas configuradas (padrão: 3 tentativas).
 */
export async function handleReportExportJobFailed(
  job: Pick<Job<ReportExportJobPayload>, 'data' | 'attemptsMade' | 'opts'> | undefined,
  error: Error,
): Promise<void> {
  if (!job?.data?.reportJobId) return;
  const maxAttempts = job.opts?.attempts ?? 3;
  if (job.attemptsMade >= maxAttempts) {
    await ReportJobService.registrarFalhaDefinitiva(
      job.data.reportJobId,
      error.message || 'Falha desconhecida ao processar relatório após múltiplas tentativas.',
    );
  }
}

export function startQueueWorkers(): {
  analyticsWorker: Worker<AnalyticsScheduledJobPayload>;
  reportsWorker: Worker<ReportExportJobPayload>;
} {
  if (!analyticsWorker) {
    analyticsWorker = new Worker<AnalyticsScheduledJobPayload>(
      ANALYTICS_SCHEDULED_QUEUE_NAME,
      async (job) => {
        await processAnalyticsScheduledJob(job.data);
      },
      {
        connection: createRedisConnection(),
      },
    );
  }

  if (!reportsWorker) {
    reportsWorker = new Worker<ReportExportJobPayload>(
      REPORTS_EXPORT_QUEUE_NAME,
      async (job) => {
        await processReportExportJob(job.data);
      },
      {
        connection: createRedisConnection(),
      },
    );

    reportsWorker.on('failed', (job, err) => {
      void handleReportExportJobFailed(job, err);
    });
  }

  return { analyticsWorker, reportsWorker };
}

export async function stopQueueWorkers(): Promise<void> {
  const closures: Promise<void>[] = [];
  if (analyticsWorker) {
    closures.push(analyticsWorker.close());
    analyticsWorker = null;
  }
  if (reportsWorker) {
    closures.push(reportsWorker.close());
    reportsWorker = null;
  }
  await Promise.allSettled(closures);
}
