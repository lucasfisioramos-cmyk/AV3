import cron, { type ScheduledTask } from 'node-cron';
import { env } from '../../config/env.js';
import { QueueDispatcher } from './queues.js';

let scheduledTask: ScheduledTask | null = null;

export async function triggerScheduledAnalyticsRun(
  triggeredBy: 'cron' | 'manual' = 'cron',
): Promise<{ bullJobId: string }> {
  return QueueDispatcher.enqueueAnalyticsCalculation({
    triggeredBy,
    requestedAt: new Date().toISOString(),
  });
}

export function startAnalyticsScheduler(): ScheduledTask | null {
  if (!env.ENABLE_CRON) {
    return null;
  }

  if (!scheduledTask) {
    scheduledTask = cron.schedule(env.ANALYTICS_CRON_SCHEDULE, () => {
      void triggerScheduledAnalyticsRun('cron');
    });
  }

  return scheduledTask;
}

export function stopAnalyticsScheduler(): void {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
  }
}
