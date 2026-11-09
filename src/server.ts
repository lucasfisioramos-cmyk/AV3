import { app } from './app.js';
import { env } from './config/env.js';

async function startServer() {
  try {
    await app.listen({ port: env.PORT, host: env.HOST });
    app.log.info({ host: env.HOST, port: env.PORT, ambiente: env.NODE_ENV }, 'Servidor Greencode iniciado');
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
