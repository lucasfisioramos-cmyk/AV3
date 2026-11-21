import { app } from './app.js';
import { env } from './config/env.js';
import { closeQueues } from './infrastructure/queue/queues.js';
import { closeRedisConnections } from './infrastructure/queue/redis.connection.js';
import {
  startAnalyticsScheduler,
  stopAnalyticsScheduler,
} from './infrastructure/queue/scheduler.js';
import { startQueueWorkers, stopQueueWorkers } from './infrastructure/queue/workers.js';

async function startServer() {
  try {
    await app.listen({ port: env.PORT, host: env.HOST });
    startQueueWorkers();
    startAnalyticsScheduler();
    app.log.info(
      { host: env.HOST, port: env.PORT, ambiente: env.NODE_ENV, cronAtivo: env.ENABLE_CRON },
      'Servidor Greencode e workers assíncronos iniciados',
    );
  } catch (err) {
    app.log.fatal({ err }, 'Falha ao iniciar o servidor');
    process.exit(1);
  }
}

// Graceful Shutdown (captura SIGINT e SIGTERM)
const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];

for (const signal of signals) {
  process.on(signal, async () => {
    app.log.warn({ signal }, 'Sinal recebido. Encerrando o servidor graciosamente...');
    try {
      stopAnalyticsScheduler();
      await stopQueueWorkers();
      await closeQueues();
      await closeRedisConnections();
      await app.close();
      app.log.info('Servidor encerrado com sucesso');
      process.exit(0);
    } catch (err) {
      app.log.error({ err }, 'Erro ao encerrar o servidor');
      process.exit(1);
    }
  });
}

startServer();
