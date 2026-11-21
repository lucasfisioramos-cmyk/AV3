import { Queue, type JobsOptions } from 'bullmq';
import type { ReportFormat } from '../../domain/shared/enums.js';
import { createRedisConnection } from './redis.connection.js';

export const ANALYTICS_SCHEDULED_QUEUE_NAME = 'analytics-scheduled-queue';
export const REPORTS_EXPORT_QUEUE_NAME = 'reports-export-queue';

export const RECALCULATE_ANALYTICS_JOB_NAME = 'recalculate-all-analytics';
export const EXPORT_REPORT_JOB_NAME = 'export-partner-report';

export const DEFAULT_BULLMQ_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 5000,
  },
};

export const REPORT_TYPES = ['EFFICIENCY', 'PROFITABILITY', 'RUL', 'TRACEABILITY'] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export interface AnalyticsScheduledJobPayload {
  triggeredBy: 'cron' | 'manual';
  requestedAt: string;
}

export interface ReportExportJobPayload {
  reportJobId: string;
  apiKeyId: string;
  reportType: ReportType | string;
  format: ReportFormat;
  filters?: Record<string, unknown>;
}

let analyticsQueueInstance: Queue<AnalyticsScheduledJobPayload> | null = null;
let reportsQueueInstance: Queue<ReportExportJobPayload> | null = null;

export function getAnalyticsScheduledQueue(): Queue<AnalyticsScheduledJobPayload> {
  if (!analyticsQueueInstance) {
    analyticsQueueInstance = new Queue<AnalyticsScheduledJobPayload>(
      ANALYTICS_SCHEDULED_QUEUE_NAME,
      {
        connection: createRedisConnection(),
        defaultJobOptions: DEFAULT_BULLMQ_JOB_OPTIONS,
      },
    );
  }
  return analyticsQueueInstance;
}

export function getReportsExportQueue(): Queue<ReportExportJobPayload> {
  if (!reportsQueueInstance) {
    reportsQueueInstance = new Queue<ReportExportJobPayload>(REPORTS_EXPORT_QUEUE_NAME, {
      connection: createRedisConnection(),
      defaultJobOptions: DEFAULT_BULLMQ_JOB_OPTIONS,
    });
  }
  return reportsQueueInstance;
}

export const QueueDispatcher = {
  async enqueueAnalyticsCalculation(
    payload: AnalyticsScheduledJobPayload,
  ): Promise<{ bullJobId: string }> {
    const queue = getAnalyticsScheduledQueue();
    const job = await queue.add(RECALCULATE_ANALYTICS_JOB_NAME, payload, DEFAULT_BULLMQ_JOB_OPTIONS);
    return { bullJobId: String(job.id ?? `analytics-${Date.now()}`) };
  },

  async enqueueReportExport(
    payload: ReportExportJobPayload,
  ): Promise<{ bullJobId: string }> {
    const queue = getReportsExportQueue();
    const job = await queue.add(EXPORT_REPORT_JOB_NAME, payload, DEFAULT_BULLMQ_JOB_OPTIONS);
    return { bullJobId: String(job.id ?? `report-${payload.reportJobId}`) };
  },
};

export async function closeQueues(): Promise<void> {
  const closures: Promise<void>[] = [];
  if (analyticsQueueInstance) {
    closures.push(analyticsQueueInstance.close());
    analyticsQueueInstance = null;
  }
  if (reportsQueueInstance) {
    closures.push(reportsQueueInstance.close());
    reportsQueueInstance = null;
  }
  await Promise.allSettled(closures);
}
