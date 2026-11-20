import { FastifyInstance } from 'fastify';
import { OrganizacaoController } from '../controllers/organizacao.controller.js';
import { ContratoController } from '../controllers/contrato.controller.js';
import { authorize, GRUPOS_DE_ACESSO } from '../security/roles.js';
import { errors, idParamsSchema } from '../schemas/common.schema.js';
import {
  criarOrganizacaoBodySchema,
  editarOrganizacaoBodySchema,
  listarOrganizacoesQuerySchema,
  listarOrganizacoesResponseSchema,
  organizacaoDetalheResponseSchema,
  organizacaoResponseSchema,
  type BuscarOrganizacaoRoute,
  type CriarOrganizacaoRoute,
  type DesativarOrganizacaoRoute,
  type EditarOrganizacaoRoute,
  type ListarOrganizacoesRoute,
} from '../schemas/organizacao.schema.js';
import {
  contratoResponseSchema,
  criarContratoBodySchema,
  encerrarContratoResponseSchema,
  renovarContratoBodySchema,
  type ContratoRoute,
  type CriarContratoRoute,
  type RenovarContratoRoute,
} from '../schemas/contrato.schema.js';

export async function organizacaoRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  app.get<ListarOrganizacoesRoute>(
    '/',
    {
      schema: {
        tags: ['Organizações'],
        summary: 'Lista as organizações',
        querystring: listarOrganizacoesQuerySchema,
        response: { 200: listarOrganizacoesResponseSchema, ...errors(401) },
      },
    },
    OrganizacaoController.index
  );

  app.get<BuscarOrganizacaoRoute>(
    '/:id',
    {
      schema: {
        tags: ['Organizações'],
        summary: 'Busca organização por ID com contrato vigente',
        response: { 200: organizacaoDetalheResponseSchema, ...errors(401, 404) },
      },
    },
    OrganizacaoController.show
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

  app.patch<EditarOrganizacaoRoute>(
    '/:id',
    {
      onRequest: authorize(GRUPOS_DE_ACESSO.GESTAO_DE_ORGANIZACOES),
      schema: {
        tags: ['Organizações'],
        summary: 'Atualiza dados de uma organização',
        params: idParamsSchema,
        body: editarOrganizacaoBodySchema,
        response: { 200: organizacaoResponseSchema, ...errors(400, 401, 403, 404) },
      },
    },
    OrganizacaoController.update
  );

  app.patch<DesativarOrganizacaoRoute>(
    '/:id/desativar',
    {
      onRequest: authorize(GRUPOS_DE_ACESSO.GESTAO_DE_ORGANIZACOES),
      schema: {
        tags: ['Organizações'],
        summary: 'Desativa uma organização',
        params: idParamsSchema,
        response: { 200: organizacaoResponseSchema, ...errors(400, 401, 403, 404) },
      },
    },
    OrganizacaoController.desativar
  );

  // ---------- Módulo de Contrato vinculado a Organização (TASK-09 / N4) ----------

  app.post<CriarContratoRoute>(
    '/:id/contrato',
    {
      onRequest: authorize(GRUPOS_DE_ACESSO.GESTAO_DE_ORGANIZACOES),
      schema: {
        tags: ['Contratos'],
        summary: 'Cria e associa um contrato vigente à organização',
        body: criarContratoBodySchema,
        response: { 201: contratoResponseSchema, ...errors(400, 401, 403, 404, 409) },
      },
    },
    ContratoController.store
  );

  app.get<ContratoRoute>(
    '/:id/contrato',
    {
      schema: {
        tags: ['Contratos'],
        summary: 'Consulta o contrato vigente da organização',
        response: { 200: contratoResponseSchema, ...errors(401, 404) },
      },
    },
    ContratoController.showVigente
  );

  app.patch<RenovarContratoRoute>(
    '/:id/contrato/renovar',
    {
      onRequest: authorize(GRUPOS_DE_ACESSO.GESTAO_DE_ORGANIZACOES),
      schema: {
        tags: ['Contratos'],
        summary: 'Renova o vencimento do contrato vigente da organização',
        body: renovarContratoBodySchema,
        response: { 200: contratoResponseSchema, ...errors(400, 401, 403, 404) },
      },
    },
    ContratoController.renovar
  );

  app.delete<ContratoRoute>(
    '/:id/contrato',
    {
      onRequest: authorize(GRUPOS_DE_ACESSO.GESTAO_DE_ORGANIZACOES),
      schema: {
        tags: ['Contratos'],
        summary: 'Encerra o contrato vigente da organização',
        response: { 200: encerrarContratoResponseSchema, ...errors(401, 403, 404) },
      },
    },
    ContratoController.encerrar
  );
}
