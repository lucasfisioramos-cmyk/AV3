import { FastifyInstance } from 'fastify';
import { sendSuccess } from '../http/response.js';
import { healthResponseSchema } from '../schemas/health.schema.js';

export async function healthRoutes(app: FastifyInstance) {
  app.get(
    '/health',
    {
      schema: {
        tags: ['Sistema'],
        summary: 'Verifica se a API está no ar',
        security: [],
        response: { 200: healthResponseSchema },
      },
    },
    async (_request, reply) =>
      sendSuccess(reply, {
        status: 'ok' as const,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      })
  );
}
