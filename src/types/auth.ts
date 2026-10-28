import type { PapelUsuario } from '@prisma/client';

/**
 * Claims explícitos do JWT emitido no login.
 * É a única fonte de verdade para o payload do token e para `request.user`.
 */
export interface JwtClaims {
  /** ID do usuário (Usuario.id). */
  sub: string;
  usuario: string;
  papel: PapelUsuario;
}

/** Usuário autenticado disponível em `request.user` após `jwtVerify()`. */
export interface AuthenticatedUser extends JwtClaims {
  /** Preenchidos pelo @fastify/jwt na emissão/verificação. */
  iat?: number;
  exp?: number;
}
