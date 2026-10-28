import { FastifyInstance } from 'fastify';
import { OrganizacaoController } from '../controllers/organizacao.controller.js';
import { authorize, GRUPOS_DE_ACESSO } from '../security/roles.js';
import { errors } from '../schemas/common.schema.js';
import {
  criarOrganizacaoBodySchema,
  listarOrganizacoesResponseSchema,
  organizacaoResponseSchema,
  type CriarOrganizacaoRoute,
} from '../schemas/organizacao.schema.js';

export async function organizacaoRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  app.get(
    '/',
    {
      schema: {
        tags: ['Organizações'],
        summary: 'Lista as organizações',
        response: { 200: listarOrganizacoesResponseSchema, ...errors(401) },
      },
    },
    OrganizacaoController.index
  );

  app.post<CriarOrganizacaoRoute>(
    '/',
    {
      onRequest: authorize(GRUPOS_DE_ACESSO.GESTAO_DE_ORGANIZACOES),
      schema: {
        tags: ['Organizações'],
        summary: 'Cadastra uma organização',
        body: criarOrganizacaoBodySchema,
        response: { 201: organizacaoResponseSchema, ...errors(400, 401, 403, 409) },
      },
    },
    OrganizacaoController.store
  );
}
