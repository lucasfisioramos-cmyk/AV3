import type { FastifyRequest } from 'fastify';
import { ApiKeyService } from '../../domain/apikey/api-key.service.js';

/**
 * Factory de hook Fastify (`onRequest`) para autenticar e autorizar parceiros B2B
 * via header `x-api-key` e escopo granular (`read:traceability`, `read:analytics`, `read:reports`, `write:lots`).
 */
export function authorizeApiKey(scope?: string) {
  return async (request: FastifyRequest): Promise<void> => {
    const headerVal = request.headers['x-api-key'];
    const rawKey = Array.isArray(headerVal) ? headerVal[0] : headerVal;
    const apiKey = await ApiKeyService.autenticarChave(rawKey, scope);
    request.apiKey = apiKey;
  };
}
