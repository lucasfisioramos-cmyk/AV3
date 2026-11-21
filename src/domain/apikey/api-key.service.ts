import { createHash, randomBytes } from 'node:crypto';
import { ForbiddenError, RegraDeNegocioError, UnauthorizedError } from '../../errors/app-error.js';
import { ApiKeyRepository, type ApiKeyMetadata } from '../../persistence/api-key.repository.js';
import { exigirEncontrado } from '../shared/guards.js';

export const ESCOPOS_API_KEY = [
  'read:traceability',
  'read:analytics',
  'read:reports',
  'write:lots',
] as const;

export type ApiKeyScope = (typeof ESCOPOS_API_KEY)[number];

export interface GerarChaveInput {
  partnerName: string;
  scopes: string[];
  rateLimit?: number;
  expiresAt?: Date | string | null;
}

export interface GerarChaveOutput {
  apiKey: ApiKeyMetadata;
  rawKey: string;
}

const ESCOPOS_VALIDOS_SET = new Set<string>(ESCOPOS_API_KEY);

export function calcularHashApiKey(rawKey: string): string {
  return createHash('sha256').update(rawKey).digest('hex');
}

export class ApiKeyService {
  static async gerarChave(dados: GerarChaveInput): Promise<GerarChaveOutput> {
    const partnerName = dados.partnerName?.trim();
    if (!partnerName) {
      throw new RegraDeNegocioError('O nome do parceiro (partnerName) é obrigatório.');
    }

    if (!Array.isArray(dados.scopes) || dados.scopes.length === 0) {
      throw new RegraDeNegocioError('A chave de API deve possuir ao menos um escopo.');
    }

    const escoposUnicos = [...new Set(dados.scopes.map((s) => s.trim()))];
    for (const escopo of escoposUnicos) {
      if (!ESCOPOS_VALIDOS_SET.has(escopo)) {
        throw new RegraDeNegocioError(`Escopo de API Key inválido: '${escopo}'.`);
      }
    }

    const rateLimit = dados.rateLimit ?? 100;
    if (!Number.isInteger(rateLimit) || rateLimit <= 0) {
      throw new RegraDeNegocioError('O limite de requisições (rateLimit) deve ser um inteiro positivo.');
    }

    let expiresAt: Date | null = null;
    if (dados.expiresAt !== undefined && dados.expiresAt !== null) {
      expiresAt = dados.expiresAt instanceof Date ? dados.expiresAt : new Date(dados.expiresAt);
      if (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) {
        throw new RegraDeNegocioError('A data de expiração (expiresAt) deve ser uma data futura válida.');
      }
    }

    const rawKey = `gc_live_${randomBytes(24).toString('hex')}`;
    const keyHash = calcularHashApiKey(rawKey);
    const keyPrefix = rawKey.slice(0, 12);

    const apiKey = await ApiKeyRepository.create({
      partnerName,
      keyPrefix,
      keyHash,
      scopes: escoposUnicos,
      rateLimit,
      expiresAt,
    });

    return { apiKey, rawKey };
  }

  static async autenticarChave(
    rawKey: string | undefined | null,
    escopoExigido?: string,
    agora: Date = new Date(),
  ): Promise<ApiKeyMetadata> {
    if (!rawKey || typeof rawKey !== 'string' || rawKey.trim().length === 0) {
      throw new UnauthorizedError('Chave de API ausente ou inválida.');
    }

    const keyHash = calcularHashApiKey(rawKey.trim());
    const apiKey = await ApiKeyRepository.findByHash(keyHash);

    if (!apiKey) {
      throw new UnauthorizedError('Chave de API inválida.');
    }

    if (!apiKey.isActive) {
      throw new UnauthorizedError('Chave de API revogada ou inativa.');
    }

    if (apiKey.expiresAt && apiKey.expiresAt <= agora) {
      throw new UnauthorizedError('Chave de API expirada.');
    }

    if (escopoExigido && !apiKey.scopes.includes(escopoExigido)) {
      throw new ForbiddenError(
        `A chave de API não possui o escopo necessário ('${escopoExigido}') para acessar este recurso.`,
      );
    }

    return apiKey;
  }

  static async listarChaves(): Promise<ApiKeyMetadata[]> {
    return ApiKeyRepository.findAll();
  }

  static async revogarChave(id: string): Promise<ApiKeyMetadata> {
    exigirEncontrado(
      await ApiKeyRepository.findById(id),
      'Chave de API não encontrada.',
    );

    return ApiKeyRepository.revoke(id);
  }
}
