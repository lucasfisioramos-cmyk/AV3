import { FastifyInstance } from 'fastify';
import { LoteController } from '../controllers/lote.controller.js';
import { authorize, GRUPOS_DE_ACESSO } from '../security/roles.js';
import { errors, idParamsSchema } from '../schemas/common.schema.js';
import {
  atualizarStatusLoteBodySchema,
  criarLoteBodySchema,
  editarLoteBodySchema,
  listarLotesQuerySchema,
  listarLotesResponseSchema,
  loteAtualizadoResponseSchema,
  loteCriadoResponseSchema,
  loteDetalheResponseSchema,
  loteExcluidoResponseSchema,
  type AtualizarStatusLoteRoute,
  type BuscarLoteRoute,
  type CriarLoteRoute,
  type EditarLoteRoute,
  type ExcluirLoteRoute,
  type ListarLotesRoute,
} from '../schemas/lote.schema.js';

export async function loteRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  app.get<ListarLotesRoute>(
    '/',
    {
      schema: {
        tags: ['Lotes'],
        summary: 'Lista os lotes',
        querystring: listarLotesQuerySchema,
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

  app.patch<AtualizarStatusLoteRoute>(
    '/:id/status',
    {
      onRequest: authorize(GRUPOS_DE_ACESSO.GESTAO_DE_LOTES),
      schema: {
        tags: ['Lotes'],
        summary: 'Transita o status do lote seguindo seu ciclo de vida',
        params: idParamsSchema,
        body: atualizarStatusLoteBodySchema,
        response: { 200: loteAtualizadoResponseSchema, ...errors(400, 401, 403, 404) },
      },
    },
    LoteController.updateStatus
  );

  app.patch<EditarLoteRoute>(
    '/:id',
    {
      onRequest: authorize(GRUPOS_DE_ACESSO.GESTAO_DE_LOTES),
      schema: {
        tags: ['Lotes'],
        summary: 'Edita dados de um lote (enquanto não finalizado)',
        params: idParamsSchema,
        body: editarLoteBodySchema,
        response: { 200: loteAtualizadoResponseSchema, ...errors(400, 401, 403, 404) },
      },
    },
    LoteController.update
  );

  app.delete<ExcluirLoteRoute>(
    '/:id',
    {
      onRequest: authorize(GRUPOS_DE_ACESSO.GESTAO_DE_LOTES),
      schema: {
        tags: ['Lotes'],
        summary: 'Exclui um lote (apenas se recebido e sem equipamentos)',
        params: idParamsSchema,
        response: { 200: loteExcluidoResponseSchema, ...errors(400, 401, 403, 404) },
      },
    },
    LoteController.delete
  );
}
