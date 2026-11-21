import { describe, expect, it } from 'vitest';
import {
  ApiKeyService,
  calcularHashApiKey,
} from '../../../../src/domain/apikey/api-key.service.js';
import {
  ForbiddenError,
  NotFoundError,
  RegraDeNegocioError,
  UnauthorizedError,
} from '../../../../src/errors/app-error.js';
import { db } from '../../../helpers/fakes.js';

describe('ApiKeyService', () => {
  it('gerarChave: gera rawKey com prefixo gc_live_, persiste apenas keyHash SHA-256 e keyPrefix (12 chars)', async () => {
    const { apiKey, rawKey } = await ApiKeyService.gerarChave({
      partnerName: 'EcoParceiro Logística',
      scopes: ['read:traceability', 'read:analytics'],
      rateLimit: 120,
    });

    expect(rawKey).toMatch(/^gc_live_[0-9a-f]{48}$/);
    expect(apiKey.keyPrefix).toBe(rawKey.slice(0, 12));
    expect(apiKey.partnerName).toBe('EcoParceiro Logística');
    expect(apiKey.scopes).toEqual(['read:traceability', 'read:analytics']);
    expect(apiKey.rateLimit).toBe(120);
    expect(apiKey.isActive).toBe(true);
    expect(apiKey).not.toHaveProperty('keyHash');
    expect(apiKey).not.toHaveProperty('rawKey');

    const registroInterno = db.apiKeys.get(apiKey.id);
    expect(registroInterno?.keyHash).toBe(calcularHashApiKey(rawKey));
    expect(registroInterno?.keyHash).not.toBe(rawKey);
  });

  it('gerarChave: valida nome do parceiro, escopos, rateLimit e expiresAt', async () => {
    await expect(
      ApiKeyService.gerarChave({ partnerName: '   ', scopes: ['read:analytics'] }),
    ).rejects.toBeInstanceOf(RegraDeNegocioError);

    await expect(
      ApiKeyService.gerarChave({ partnerName: 'Parceiro', scopes: [] }),
    ).rejects.toBeInstanceOf(RegraDeNegocioError);

    await expect(
      ApiKeyService.gerarChave({ partnerName: 'Parceiro', scopes: ['escopo:invalido'] }),
    ).rejects.toBeInstanceOf(RegraDeNegocioError);

    await expect(
      ApiKeyService.gerarChave({
        partnerName: 'Parceiro',
        scopes: ['read:analytics'],
        rateLimit: 0,
      }),
    ).rejects.toBeInstanceOf(RegraDeNegocioError);

    await expect(
      ApiKeyService.gerarChave({
        partnerName: 'Parceiro',
        scopes: ['read:analytics'],
        expiresAt: new Date(Date.now() - 60_000),
      }),
    ).rejects.toBeInstanceOf(RegraDeNegocioError);
  });

  it('autenticarChave: autentica chave válida com escopo exigido', async () => {
    const { apiKey, rawKey } = await ApiKeyService.gerarChave({
      partnerName: 'Parceiro B2B',
      scopes: ['read:analytics'],
    });

    const autenticada = await ApiKeyService.autenticarChave(rawKey, 'read:analytics');
    expect(autenticada.id).toBe(apiKey.id);
  });

  it('autenticarChave: rejeita chave ausente, inexistente, revogada ou expirada com 401 UnauthorizedError', async () => {
    await expect(
      ApiKeyService.autenticarChave(undefined, 'read:analytics'),
    ).rejects.toBeInstanceOf(UnauthorizedError);

    await expect(
      ApiKeyService.autenticarChave('gc_live_inexistente', 'read:analytics'),
    ).rejects.toBeInstanceOf(UnauthorizedError);

    const { apiKey, rawKey } = await ApiKeyService.gerarChave({
      partnerName: 'Parceiro Revogado',
      scopes: ['read:analytics'],
      expiresAt: new Date(Date.now() + 60_000),
    });

    // Simula expiração no futuro
    await expect(
      ApiKeyService.autenticarChave(
        rawKey,
        'read:analytics',
        new Date(Date.now() + 120_000),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedError);

    // Revoga a chave
    await ApiKeyService.revogarChave(apiKey.id);
    await expect(
      ApiKeyService.autenticarChave(rawKey, 'read:analytics'),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('autenticarChave: rejeita chave válida sem o escopo exigido com 403 ForbiddenError', async () => {
    const { rawKey } = await ApiKeyService.gerarChave({
      partnerName: 'Parceiro Somente Rastreabilidade',
      scopes: ['read:traceability'],
    });

    await expect(
      ApiKeyService.autenticarChave(rawKey, 'read:analytics'),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('listarChaves e revogarChave: lista metadados sem segredo e lança NotFoundError ao revogar ID inexistente', async () => {
    const { apiKey } = await ApiKeyService.gerarChave({
      partnerName: 'Parceiro Lista',
      scopes: ['read:reports'],
    });

    const lista = await ApiKeyService.listarChaves();
    expect(lista).toHaveLength(1);
    expect(lista[0]?.id).toBe(apiKey.id);
    expect(lista[0]).not.toHaveProperty('rawKey');
    expect(lista[0]).not.toHaveProperty('keyHash');

    await expect(
      ApiKeyService.revogarChave('00000000-0000-0000-0000-000000000000'),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
