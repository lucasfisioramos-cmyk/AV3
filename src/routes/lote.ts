import { FastifyInstance } from 'fastify';
import { LoteController } from '../controllers/lote.controller.js';
import { authorize, GRUPOS_DE_ACESSO } from '../security/roles.js';
import { errors, idParamsSchema } from '../schemas/common.schema.js';
import {
  criarLoteBodySchema,
  listarLotesResponseSchema,
  loteCriadoResponseSchema,
  loteDetalheResponseSchema,
  type BuscarLoteRoute,
  type CriarLoteRoute,
} from '../schemas/lote.schema.js';

export async function loteRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  app.get(
    '/',
    {
      schema: {
        tags: ['Lotes'],
        summary: 'Lista os lotes',
        response: { 200: listarLotesResponseSchema, ...errors(401) },
      },
    },
    LoteController.index
  );

  app.get<BuscarLoteRoute>(
    '/:id',
    {
      schema: {
        tags: ['Lotes'],
        summary: 'Busca um lote pelo ID, com organização e equipamentos',
        params: idParamsSchema,
        response: { 200: loteDetalheResponseSchema, ...errors(400, 401, 404) },
      },
    },
    LoteController.show
  );

  app.post<CriarLoteRoute>(
    '/',
    {
      onRequest: authorize(GRUPOS_DE_ACESSO.GESTAO_DE_LOTES),
      schema: {
        tags: ['Lotes'],
        summary: 'Registra um novo lote',
        body: criarLoteBodySchema,
        response: { 201: loteCriadoResponseSchema, ...errors(400, 401, 403, 404, 409) },
      },
    },
    LoteController.store
  );
}
