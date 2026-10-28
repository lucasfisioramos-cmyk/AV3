import { FastifyInstance } from 'fastify';
import { EquipamentoController } from '../controllers/equipamento.controller.js';
import { authorize, GRUPOS_DE_ACESSO } from '../security/roles.js';
import { errors, idParamsSchema } from '../schemas/common.schema.js';
import {
  alterarEstadoFisicoBodySchema,
  criarEquipamentoBodySchema,
  equipamentoResponseSchema,
  movimentarEquipamentoBodySchema,
  movimentarEquipamentoResponseSchema,
  rastrearEquipamentoResponseSchema,
  rastrearParamsSchema,
  type AlterarEstadoFisicoRoute,
  type CriarEquipamentoRoute,
  type MovimentarEquipamentoRoute,
  type RastrearEquipamentoRoute,
} from '../schemas/equipamento.schema.js';

export async function equipamentoRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  const operadores = authorize(GRUPOS_DE_ACESSO.OPERACAO_DE_EQUIPAMENTOS);

  app.get<RastrearEquipamentoRoute>(
    '/rastrear/:identificador',
    {
      schema: {
        tags: ['Equipamentos'],
        summary: 'Rastreia um equipamento por ID ou código de barras interno',
        params: rastrearParamsSchema,
        response: { 200: rastrearEquipamentoResponseSchema, ...errors(400, 401, 404) },
      },
    },
    EquipamentoController.rastrear
  );

  app.post<CriarEquipamentoRoute>(
    '/',
    {
      onRequest: operadores,
      schema: {
        tags: ['Equipamentos'],
        summary: 'Cadastra um equipamento em um lote',
        body: criarEquipamentoBodySchema,
        response: { 201: equipamentoResponseSchema, ...errors(400, 401, 403, 404) },
      },
    },
    EquipamentoController.store
  );

  app.patch<MovimentarEquipamentoRoute>(
    '/:id/movimentar',
    {
      onRequest: operadores,
      schema: {
        tags: ['Equipamentos'],
        summary: 'Movimenta o equipamento e registra no histórico',
        params: idParamsSchema,
        body: movimentarEquipamentoBodySchema,
        response: { 200: movimentarEquipamentoResponseSchema, ...errors(400, 401, 403, 404, 409) },
      },
    },
    EquipamentoController.movimentar
  );

  app.patch<AlterarEstadoFisicoRoute>(
    '/:id/estado-fisico',
    {
      onRequest: operadores,
      schema: {
        tags: ['Equipamentos'],
        summary: 'Altera o estado físico do equipamento',
        params: idParamsSchema,
        body: alterarEstadoFisicoBodySchema,
        response: { 200: equipamentoResponseSchema, ...errors(400, 401, 403, 404, 409) },
      },
    },
    EquipamentoController.alterarEstadoFisico
  );
}
