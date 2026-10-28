import { FastifyRequest } from 'fastify';
import { PapelUsuario } from '@prisma/client';
import { ForbiddenError } from '../errors/app-error.js';

export function authorize(rolesPermitidos: PapelUsuario[]) {
  return async (request: FastifyRequest) => {
    // request.user é populado automaticamente pelo request.jwtVerify()
    const user = request.user as { papel: PapelUsuario };

    if (!user || !rolesPermitidos.includes(user.papel)) {
      throw new ForbiddenError();
    }
  };
}
