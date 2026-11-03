import { prisma } from '../persistence/prisma.js';
import type { Transacao } from '../persistence/transaction.js';
import type { CrudRepository } from './base.repository.js';
import type { Organizacao } from './entities.js';

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

export interface OrganizacaoFiltro {
  ativo?: boolean;
}

export interface OrganizacaoRepository
  extends CrudRepository<Organizacao, CriarOrganizacaoData, AtualizarOrganizacaoData, OrganizacaoFiltro> {
  findByCnpj(cnpj: string, tx?: Transacao): Promise<Organizacao | null>;
}

class PrismaOrganizacaoRepository implements OrganizacaoRepository {
  findById(id: string, tx?: Transacao) {
    return (tx ?? prisma).organizacao.findUnique({ where: { id } });
  }

  findAll(filtro: OrganizacaoFiltro = {}, tx?: Transacao) {
    return (tx ?? prisma).organizacao.findMany({
      where: { ativo: filtro.ativo },
      orderBy: { razaoSocial: 'asc' },
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
    return (tx ?? prisma).organizacao.count({ where: { ativo: filtro.ativo } });
  }
}

export const OrganizacaoRepository: OrganizacaoRepository = new PrismaOrganizacaoRepository();
