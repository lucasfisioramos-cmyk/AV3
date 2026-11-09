import type { FastifyJWTOptions } from '@fastify/jwt';
import { env } from '../config/env.js';

/**
 * Configuração explícita do JWT (autenticação STATELESS).
 *  - algoritmo fixo (HS256): impede troca de algoritmo no token ("alg" é verificado);
 *  - `iss`/`aud` fixos na emissão e exigidos na verificação;
 *  - `exp` sempre presente (expiresIn) e validado pela biblioteca.
 */
export const jwtOptions: FastifyJWTOptions = {
  secret: env.JWT_SECRET,
  sign: {
    algorithm: 'HS256',
    iss: env.JWT_ISSUER,
    aud: env.JWT_AUDIENCE,
    expiresIn: env.JWT_EXPIRES_IN,
  },
  verify: {
    algorithms: ['HS256'],
    allowedIss: env.JWT_ISSUER,
    allowedAud: env.JWT_AUDIENCE,
  },
};
