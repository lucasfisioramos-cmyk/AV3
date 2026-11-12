import type { FastifyRequest } from 'fastify';
import { PapelUsuario } from '../domain/shared/enums.js';
import { ForbiddenError } from '../errors/app-error.js';

const { ADMINISTRADOR, OPERADOR_CADASTRO, GESTOR_ALMOXARIFADO, AUDITOR } = PapelUsuario;

/** Grupos de acesso nomeados, reutilizados pelas rotas. */
export const GRUPOS_DE_ACESSO = {
  ADMINISTRADORES: [ADMINISTRADOR],
  GESTAO_DE_ORGANIZACOES: [ADMINISTRADOR, OPERADOR_CADASTRO],
  GESTAO_DE_LOTES: [ADMINISTRADOR, GESTOR_ALMOXARIFADO],
  OPERACAO_DE_EQUIPAMENTOS: [ADMINISTRADOR, OPERADOR_CADASTRO, GESTOR_ALMOXARIFADO],
  RELATORIOS: [ADMINISTRADOR, GESTOR_ALMOXARIFADO, AUDITOR],
} as const satisfies Record<string, readonly PapelUsuario[]>;

/**
 * Hook de autorização por papel. Deve rodar após `authenticate`.
 * Registre-o em `onRequest` (e não em `preHandler`): assim o acesso é negado (403) antes de
 * o corpo ser validado, e quem não tem permissão nunca recebe detalhes de validação (400).
 */
export function authorize(rolesPermitidos: readonly PapelUsuario[]) {
  return async (request: FastifyRequest): Promise<void> => {
    if (!request.user || !rolesPermitidos.includes(request.user.papel)) {
      throw new ForbiddenError();
    }
  };
}
