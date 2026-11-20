import { Prisma } from '@prisma/client';
import { prisma } from '../persistence/prisma.js';
import type { Transacao } from '../persistence/transaction.js';
import { ConflictError } from '../errors/app-error.js';
import type { Contrato } from './entities.js';

export interface CriarContratoData {
  organizacaoId: string;
  dataAssinatura: Date;
  dataVencimento: Date;
  clausulas: string[];
  valorMensal: number;
  renovacaoAutomatica?: boolean;
  ativo?: boolean;
}

export interface AtualizarContratoData {
  dataVencimento?: Date;
  clausulas?: string[];
  valorMensal?: number;
  renovacaoAutomatica?: boolean;
  ativo?: boolean;
}

export interface ContratoRepository {
  findById(id: string, tx?: Transacao): Promise<Contrato | null>;
  findVigenteByOrganizacaoId(organizacaoId: string, tx?: Transacao): Promise<Contrato | null>;
  findAllByOrganizacaoId(organizacaoId: string, tx?: Transacao): Promise<Contrato[]>;
  create(data: CriarContratoData, tx?: Transacao): Promise<Contrato>;
  update(id: string, data: AtualizarContratoData, tx?: Transacao): Promise<Contrato>;
  desativar(id: string, tx?: Transacao): Promise<Contrato>;
}

class PrismaContratoRepository implements ContratoRepository {
  private toEntity(raw: {
    id: string;
    organizacaoId: string;
    dataAssinatura: Date;
    dataVencimento: Date;
    clausulas: Prisma.JsonValue;
    valorMensal: number;
    renovacaoAutomatica: boolean;
    ativo: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): Contrato {
    return {
      ...raw,
      clausulas: Array.isArray(raw.clausulas) ? (raw.clausulas as string[]) : [],
    };
  }

  async findById(id: string, tx?: Transacao): Promise<Contrato | null> {
    const raw = await (tx ?? prisma).contrato.findUnique({ where: { id } });
    return raw ? this.toEntity(raw) : null;
  }

  async findVigenteByOrganizacaoId(organizacaoId: string, tx?: Transacao): Promise<Contrato | null> {
    const raw = await (tx ?? prisma).contrato.findFirst({
      where: {
        organizacaoId,
        ativo: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return raw ? this.toEntity(raw) : null;
  }

  async findAllByOrganizacaoId(organizacaoId: string, tx?: Transacao): Promise<Contrato[]> {
    const lista = await (tx ?? prisma).contrato.findMany({
      where: { organizacaoId },
      orderBy: { createdAt: 'desc' },
    });
    return lista.map((raw) => this.toEntity(raw));
  }

  async create(data: CriarContratoData, tx?: Transacao): Promise<Contrato> {
    try {
      const raw = await (tx ?? prisma).contrato.create({
        data: {
          organizacaoId: data.organizacaoId,
          dataAssinatura: data.dataAssinatura,
          dataVencimento: data.dataVencimento,
          clausulas: data.clausulas,
          valorMensal: data.valorMensal,
          renovacaoAutomatica: data.renovacaoAutomatica ?? true,
          ativo: data.ativo ?? true,
        },
      });
      return this.toEntity(raw);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictError('A organização já possui um contrato ativo/vigente cadastrado.');
      }
      throw error;
    }
  }

  async update(id: string, data: AtualizarContratoData, tx?: Transacao): Promise<Contrato> {
    const raw = await (tx ?? prisma).contrato.update({
      where: { id },
      data: {
        ...(data.dataVencimento !== undefined ? { dataVencimento: data.dataVencimento } : {}),
        ...(data.clausulas !== undefined ? { clausulas: data.clausulas } : {}),
        ...(data.valorMensal !== undefined ? { valorMensal: data.valorMensal } : {}),
        ...(data.renovacaoAutomatica !== undefined ? { renovacaoAutomatica: data.renovacaoAutomatica } : {}),
        ...(data.ativo !== undefined ? { ativo: data.ativo } : {}),
      },
    });
    return this.toEntity(raw);
  }

  async desativar(id: string, tx?: Transacao): Promise<Contrato> {
    return this.update(id, { ativo: false }, tx);
  }
}

export const ContratoRepository: ContratoRepository = new PrismaContratoRepository();
