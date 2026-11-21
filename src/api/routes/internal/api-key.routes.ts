import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ApiKeyService, ESCOPOS_API_KEY } from '../../../domain/apikey/api-key.service.js';
import { sendCreated, sendSuccess } from '../../../http/response.js';
import {
  dateTimeSchema,
  envelope,
  errors,
  idParamsSchema,
  type IdParams,
} from '../../../schemas/common.schema.js';
import { authorize, GRUPOS_DE_ACESSO } from '../../../security/roles.js';

export const apiKeyScopeSchema = z.enum(ESCOPOS_API_KEY);

export const apiKeyMetadataSchema = z.object({
  id: z.uuid(),
  partnerName: z.string(),
  keyPrefix: z.string(),
  scopes: z.array(z.string()),
  isActive: z.boolean(),
  rateLimit: z.number().int(),
  createdAt: dateTimeSchema,
  expiresAt: dateTimeSchema.nullable(),
});

export const apiKeyCreatedDataSchema = apiKeyMetadataSchema.extend({
  rawKey: z.string(),
});

export const criarApiKeyBodySchema = z.object({
  partnerName: z.string().trim().min(1).max(150),
  scopes: z.array(apiKeyScopeSchema).min(1),
  rateLimit: z.number().int().min(1).max(10_000).optional(),
  expiresAt: dateTimeSchema.nullable().optional(),
});

export type CriarApiKeyBody = z.infer<typeof criarApiKeyBodySchema>;

export const apiKeyCriadaResponseSchema = envelope(apiKeyCreatedDataSchema);
export const listarApiKeysResponseSchema = envelope(z.array(apiKeyMetadataSchema));
export const revogarApiKeyResponseSchema = envelope(apiKeyMetadataSchema);

export async function apiKeyRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);
  const apenasAdministradores = authorize(GRUPOS_DE_ACESSO.ADMINISTRADORES);

  app.post<{ Body: CriarApiKeyBody }>(
    '/',
    {
      onRequest: apenasAdministradores,
      schema: {
        tags: ['Interno - API Keys'],
        summary: 'Gera uma nova chave de API para parceiro B2B (somente administrador)',
        security: [{ bearerAuth: [] }],
        body: criarApiKeyBodySchema,
        response: {
          201: apiKeyCriadaResponseSchema,
          ...errors(400, 401, 403),
        },
      },
    },
    async (request, reply) => {
      const { apiKey, rawKey } = await ApiKeyService.gerarChave(request.body);
      return sendCreated(
        reply,
        { ...apiKey, rawKey },
        {
          message:
            'Chave de API gerada com sucesso. Guarde o segredo com segurança, pois ele não será exibido novamente.',
        },
      );
    },
  );

  app.get(
    '/',
    {
      onRequest: apenasAdministradores,
      schema: {
        tags: ['Interno - API Keys'],
        summary: 'Lista todas as chaves de API cadastradas sem expor o segredo (somente administrador)',
        security: [{ bearerAuth: [] }],
        response: {
          200: listarApiKeysResponseSchema,
          ...errors(401, 403),
        },
      },
    },
    async (_request, reply) => {
      const chaves = await ApiKeyService.listarChaves();
      return sendSuccess(reply, chaves);
    },
  );

  app.delete<{ Params: IdParams }>(
    '/:id',
    {
      onRequest: apenasAdministradores,
      schema: {
        tags: ['Interno - API Keys'],
        summary: 'Revoga uma chave de API existente (somente administrador)',
        security: [{ bearerAuth: [] }],
        params: idParamsSchema,
        response: {
          200: revogarApiKeyResponseSchema,
          ...errors(400, 401, 403, 404),
        },
      },
    },
    async (request, reply) => {
      const revogada = await ApiKeyService.revogarChave(request.params.id);
      return sendSuccess(reply, revogada, {
        message: 'Chave de API revogada com sucesso.',
      });
    },
  );
}
