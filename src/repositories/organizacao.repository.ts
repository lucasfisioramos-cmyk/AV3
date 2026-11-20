import type { Prisma } from '@prisma/client';
import { prisma } from '../persistence/prisma.js';
import type { Transacao } from '../persistence/transaction.js';
import type { CrudRepository, PaginacaoFiltro } from './base.repository.js';
import type { Organizacao, OrganizacaoDetalhe } from './entities.js';

export interface CriarOrganizacaoData {
  razaoSocial: string;
  cnpj: string;
  inscricaoEstadual?: string | null;
  enderecoCompleto: string;
  telefone: string;
  email: string;
}

export interface AtualizarOrganizacaoData {
  razaoSocial?: string;
  cnpj?: string;
  inscricaoEstadual?: string | null;
  enderecoCompleto?: string;
  telefone?: string;
  email?: string;
  ativo?: boolean;
}

export interface OrganizacaoFiltro extends PaginacaoFiltro {
  ativo?: boolean;
  cnpj?: string;
  razaoSocial?: string;
}

export interface OrganizacaoRepository
  extends CrudRepository<Organizacao, CriarOrganizacaoData, AtualizarOrganizacaoData, OrganizacaoFiltro> {
  findByCnpj(cnpj: string, tx?: Transacao): Promise<Organizacao | null>;
  findDetalheById(id: string, tx?: Transacao): Promise<OrganizacaoDetalhe | null>;
}

class PrismaOrganizacaoRepository implements OrganizacaoRepository {
  findById(id: string, tx?: Transacao) {
    return (tx ?? prisma).organizacao.findUnique({ where: { id } });
  }

  async findDetalheById(id: string, tx?: Transacao): Promise<OrganizacaoDetalhe | null> {
    const raw = await (tx ?? prisma).organizacao.findUnique({
      where: { id },
      include: {
        contratos: {
          where: { ativo: true },
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!raw) return null;

    const { contratos, ...org } = raw;
    const contratoAtivo = contratos[0]
      ? {
          ...contratos[0],
          clausulas: Array.isArray(contratos[0].clausulas)
            ? (contratos[0].clausulas as string[])
            : [],
        }
      : null;

    return {
      ...org,
      contratoVigente: contratoAtivo,
    };
  }

  private montarWhere(filtro: OrganizacaoFiltro): Prisma.OrganizacaoWhereInput {
    const where: Prisma.OrganizacaoWhereInput = {};
    if (filtro.ativo !== undefined) where.ativo = filtro.ativo;
    if (filtro.cnpj) where.cnpj = { contains: filtro.cnpj };
    if (filtro.razaoSocial) where.razaoSocial = { contains: filtro.razaoSocial, mode: 'insensitive' };
    return where;
  }

  findAll(filtro: OrganizacaoFiltro = {}, tx?: Transacao) {
    return (tx ?? prisma).organizacao.findMany({
      where: this.montarWhere(filtro),
      orderBy: { razaoSocial: 'asc' },
      skip: filtro.skip,
      take: filtro.take,
    });
  }

  findByCnpj(cnpj: string, tx?: Transacao) {
    return (tx ?? prisma).organizacao.findUnique({ where: { cnpj } });
  }

  create(data: CriarOrganizacaoData, tx?: Transacao) {
    return (tx ?? prisma).organizacao.create({
      data: { ...data, inscricaoEstadual: data.inscricaoEstadual ?? null },
    });
  }

  update(id: string, data: AtualizarOrganizacaoData, tx?: Transacao) {
    return (tx ?? prisma).organizacao.update({ where: { id }, data });
  }

  async delete(id: string, tx?: Transacao) {
    await (tx ?? prisma).organizacao.delete({ where: { id } });
  }

  count(filtro: OrganizacaoFiltro = {}, tx?: Transacao) {
    return (tx ?? prisma).organizacao.count({ where: this.montarWhere(filtro) });
  }
}

export const OrganizacaoRepository: OrganizacaoRepository = new PrismaOrganizacaoRepository();
