import '@fastify/jwt';
import type { FastifyRequest } from 'fastify';
import type { AuthenticatedUser, JwtClaims } from './auth.js';

declare module 'fastify' {
  interface FastifyInstance {
    /** Hook de autenticação JWT. Lança UnauthorizedError (401) em caso de falha. */
    authenticate: (request: FastifyRequest) => Promise<void>;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtClaims;
    user: AuthenticatedUser;
  }
}
