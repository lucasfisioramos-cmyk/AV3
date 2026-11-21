import { Redis, type RedisOptions } from 'ioredis';
import { env } from '../../config/env.js';

const activeConnections = new Set<Redis>();

export function getBullMqRedisOptions(): RedisOptions {
  return {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: env.NODE_ENV === 'test',
  };
}

/**
 * Factory de conexão IORedis compatível com o BullMQ (`maxRetriesPerRequest: null`).
 * Mantém registro das conexões abertas para encerramento gracioso (`closeRedisConnections`).
 */
export function createRedisConnection(redisUrl: string = env.REDIS_URL): Redis {
  const client = new Redis(redisUrl, getBullMqRedisOptions());
  activeConnections.add(client);
  return client;
}

export async function closeRedisConnections(): Promise<void> {
  const closures = [...activeConnections].map(async (conn) => {
    try {
      if (conn.status !== 'end' && conn.status !== 'wait') {
        await conn.quit();
      } else {
        conn.disconnect();
      }
    } catch {
      conn.disconnect();
    }
  });
  activeConnections.clear();
  await Promise.allSettled(closures);
}
