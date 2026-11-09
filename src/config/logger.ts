import type { FastifyServerOptions } from 'fastify';
import { env } from './env.js';

/**
 * Logger estruturado (pino, via Fastify): JSON em produção, legível em desenvolvimento.
 *
 * Dados sensíveis NUNCA devem ser registrados:
 *  - o serializador de requisição não inclui headers, body nem query string;
 *  - `redact` censura credenciais caso algum objeto com esses campos seja logado por engano.
 */
export const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  'headers.authorization',
  'authorization',
  'password',
  'senha',
  'senhaPlana',
  'novaSenha',
  'hashSenha',
  'token',
  '*.password',
  '*.senha',
  '*.senhaPlana',
  '*.novaSenha',
  '*.hashSenha',
  '*.token',
  '*.authorization',
];

type LoggerOptions = Exclude<FastifyServerOptions['logger'], boolean | undefined>;

export const loggerOptions: LoggerOptions = {
  level: env.LOG_LEVEL,
  redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
  formatters: { level: (label) => ({ level: label }) },
  timestamp: () => `,"time":"${new Date().toISOString()}"`,
  serializers: {
    req(request) {
      return {
        method: request.method,
        // Sem query string: ela pode carregar tokens ou dados pessoais.
        url: (request.url ?? '').split('?')[0],
        remoteAddress: request.ip,
      };
    },
  },
  ...(env.NODE_ENV === 'development'
    ? {
        transport: {
          target: 'pino-pretty',
          options: { translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
        },
      }
    : {}),
};
