import type { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';
import type { Transacao } from './transaction.js';

export interface ApiKeyMetadata {
  id: string;
  partnerName: string;
  keyPrefix: string;
  scopes: string[];
  isActive: boolean;
  rateLimit: number;
  createdAt: Date;
  expiresAt: Date | null;
}

export interface CreateApiKeyData {
  partnerName: string;
  keyPrefix: string;
  keyHash: string;
  scopes: string[];
  rateLimit?: number;
  expiresAt?: Date | null;
}

export interface ApiKeyRepository {
  create(data: CreateApiKeyData, tx?: Transacao): Promise<ApiKeyMetadata>;
  findByHash(keyHash: string, tx?: Transacao): Promise<ApiKeyMetadata | null>;
  findById(id: string, tx?: Transacao): Promise<ApiKeyMetadata | null>;
  findAll(tx?: Transacao): Promise<ApiKeyMetadata[]>;
  revoke(id: string, tx?: Transacao): Promise<ApiKeyMetadata>;
}

const SELECT_PUBLICO = {
  id: true,
  partnerName: true,
  keyPrefix: true,
  scopes: true,
  isActive: true,
  rateLimit: true,
  createdAt: true,
  expiresAt: true,
} as const satisfies Prisma.ApiKeySelect;

class PrismaApiKeyRepository implements ApiKeyRepository {
  create(data: CreateApiKeyData, tx?: Transacao): Promise<ApiKeyMetadata> {
    return (tx ?? prisma).apiKey.create({
      data,
      select: SELECT_PUBLICO,
    });
  }

  findByHash(keyHash: string, tx?: Transacao): Promise<ApiKeyMetadata | null> {
    return (tx ?? prisma).apiKey.findUnique({
      where: { keyHash },
      select: SELECT_PUBLICO,
    });
  }

  findById(id: string, tx?: Transacao): Promise<ApiKeyMetadata | null> {
    return (tx ?? prisma).apiKey.findUnique({
      where: { id },
      select: SELECT_PUBLICO,
    });
  }

  findAll(tx?: Transacao): Promise<ApiKeyMetadata[]> {
    return (tx ?? prisma).apiKey.findMany({
      select: SELECT_PUBLICO,
      orderBy: { createdAt: 'desc' },
    });
  }

  revoke(id: string, tx?: Transacao): Promise<ApiKeyMetadata> {
    return (tx ?? prisma).apiKey.update({
      where: { id },
      data: { isActive: false },
      select: SELECT_PUBLICO,
    });
  }
}

export const ApiKeyRepository: ApiKeyRepository = new PrismaApiKeyRepository();
