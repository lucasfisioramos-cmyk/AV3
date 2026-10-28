import { FastifyInstance } from 'fastify';
import { RelatorioController } from '../controllers/relatorio.controller.js';
import { authorize, GRUPOS_DE_ACESSO } from '../security/roles.js';
import { errors, idParamsSchema, type IdParams } from '../schemas/common.schema.js';
import { dashboardResponseSchema, relatorioOrganizacaoResponseSchema } from '../schemas/relatorio.schema.js';

export async function relatorioRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  const perfisAutorizados = authorize(GRUPOS_DE_ACESSO.RELATORIOS);

  app.get(
    '/status',
    {
      onRequest: perfisAutorizados,
      schema: {
        tags: ['Relatórios'],
        summary: 'Dashboard geral de lotes e equipamentos',
        response: { 200: dashboardResponseSchema, ...errors(401, 403) },
      },
    },
    RelatorioController.dashboardGeral
  );

  app.get<{ Params: IdParams }>(
    '/organizacao/:id',
    {
      onRequest: perfisAutorizados,
      schema: {
        tags: ['Relatórios'],
        summary: 'Métricas de uma organização',
        params: idParamsSchema,
        response: { 200: relatorioOrganizacaoResponseSchema, ...errors(400, 401, 403, 404) },
      },
    },
    RelatorioController.relatorioOrganizacao
  );
}
