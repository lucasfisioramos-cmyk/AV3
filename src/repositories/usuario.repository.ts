import type { Prisma } from '@prisma/client';
import { prisma } from '../persistence/prisma.js';
import type { Transacao } from '../persistence/transaction.js';
import type { PapelUsuario } from '../domain/shared/enums.js';
import type { CrudRepository } from './base.repository.js';
import type { Usuario } from './entities.js';

export interface UsuarioCredencial {
  id: string;
  usuario: string;
  papel: PapelUsuario;
  hashSenha: string;
}

export interface CriarUsuarioData {
  usuario: string;
  hashSenha: string;
  papel: PapelUsuario;
}

export interface AtualizarUsuarioData {
  usuario?: string;
  hashSenha?: string;
  papel?: PapelUsuario;
  ultimoAcesso?: Date;
}

export interface UsuarioFiltro {
  papel?: PapelUsuario;
}

export interface UsuarioRepository extends CrudRepository<Usuario, CriarUsuarioData, AtualizarUsuarioData, UsuarioFiltro> {
  findByUsuario(usuario: string, tx?: Transacao): Promise<Usuario | null>;
  /** ÚNICO caminho que devolve o hash da senha; use apenas para autenticar. */
  findCredencialByUsuario(usuario: string, tx?: Transacao): Promise<UsuarioCredencial | null>;
}

// Campos devolvidos por padrão: sem hashSenha.
const SELECT_PUBLICO = {
  id: true,
  usuario: true,
  papel: true,
  ultimoAcesso: true,
  createdAt: true,
  updatedAt: true,
} as const satisfies Prisma.UsuarioSelect;

const SELECT_CREDENCIAL = {
  id: true,
  usuario: true,
  papel: true,
  hashSenha: true,
} as const satisfies Prisma.UsuarioSelect;

class PrismaUsuarioRepository implements UsuarioRepository {
  findById(id: string, tx?: Transacao) {
    return (tx ?? prisma).usuario.findUnique({ where: { id }, select: SELECT_PUBLICO });
  }

  findAll(filtro: UsuarioFiltro = {}, tx?: Transacao) {
    return (tx ?? prisma).usuario.findMany({
      where: { papel: filtro.papel },
      select: SELECT_PUBLICO,
      orderBy: { usuario: 'asc' },
    });
  }

  findByUsuario(usuario: string, tx?: Transacao) {
    return (tx ?? prisma).usuario.findUnique({ where: { usuario }, select: SELECT_PUBLICO });
  }

  findCredencialByUsuario(usuario: string, tx?: Transacao) {
    return (tx ?? prisma).usuario.findUnique({ where: { usuario }, select: SELECT_CREDENCIAL });
  }

  create(data: CriarUsuarioData, tx?: Transacao) {
    return (tx ?? prisma).usuario.create({ data, select: SELECT_PUBLICO });
  }

  update(id: string, data: AtualizarUsuarioData, tx?: Transacao) {
    return (tx ?? prisma).usuario.update({ where: { id }, data, select: SELECT_PUBLICO });
  }

  async delete(id: string, tx?: Transacao) {
    await (tx ?? prisma).usuario.delete({ where: { id } });
  }

  count(filtro: UsuarioFiltro = {}, tx?: Transacao) {
    return (tx ?? prisma).usuario.count({ where: { papel: filtro.papel } });
  }
}

export const UsuarioRepository: UsuarioRepository = new PrismaUsuarioRepository();
