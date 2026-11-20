import type { PapelUsuario } from '../domain/shared/enums.js';

/**
 * Claims explícitos do JWT emitido no login.
 * É a única fonte de verdade para o payload do token e para `request.user`.
 */
export interface JwtClaims {
  /** ID do usuário (Usuario.id). */
  sub: string;
  usuario: string;
  papel: PapelUsuario;
  /** Identificador único do token (rastreabilidade em logs e base para revogação). */
  jti: string;
}

/** Usuário autenticado disponível em `request.user` após `jwtVerify()`. */
export interface AuthenticatedUser extends JwtClaims {
  /** Claims registrados, preenchidos na emissão pelo plugin (validados na verificação). */
  iat: number;
  exp: number;
  iss: string;
  aud: string | string[];
}
