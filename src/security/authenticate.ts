import type { FastifyRequest } from 'fastify';
import { PapelUsuario } from '../domain/shared/enums.js';
import { UnauthorizedError } from '../errors/app-error.js';

const PAPEIS_VALIDOS: readonly string[] = Object.values(PapelUsuario);

/**
 * Hook de autenticação: verifica a assinatura/expiração do JWT e garante que
 * os claims esperados estão presentes. Falhas seguem para o handler global.
 */
export async function authenticate(request: FastifyRequest): Promise<void> {
  try {
    await request.jwtVerify();
  } catch {
    throw new UnauthorizedError();
  }

  const { sub, papel } = request.user;
  if (typeof sub !== 'string' || sub === '' || !PAPEIS_VALIDOS.includes(papel)) {
    throw new UnauthorizedError();
  }
}
