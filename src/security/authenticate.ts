import type { FastifyRequest } from 'fastify';
import { PapelUsuario } from '../domain/shared/enums.js';
import { env } from '../config/env.js';
import { UnauthorizedError } from '../errors/app-error.js';

const PAPEIS_VALIDOS: readonly string[] = Object.values(PapelUsuario);

const ehTextoNaoVazio = (valor: unknown): valor is string => typeof valor === 'string' && valor.trim() !== '';

/**
 * Hook de autenticação. O plugin valida assinatura, algoritmo e `exp`/`iss`/`aud` QUANDO presentes;
 * aqui exigimos que TODOS os claims esperados existam e tenham o valor correto
 * (um token sem `iss`/`aud`/`exp` nunca é aceito). Qualquer falha vira 401 genérico
 * (o motivo não é revelado ao cliente).
 */
export async function authenticate(request: FastifyRequest): Promise<void> {
  try {
    await request.jwtVerify();
  } catch {
    throw new UnauthorizedError();
  }

  const { sub, usuario, papel, exp, iss, aud } = request.user;
  const audiencias = Array.isArray(aud) ? aud : [aud];
  const claimsValidos =
    ehTextoNaoVazio(sub) &&
    ehTextoNaoVazio(usuario) &&
    PAPEIS_VALIDOS.includes(papel) &&
    typeof exp === 'number' && // token sem expiração nunca é aceito
    iss === env.JWT_ISSUER &&
    audiencias.includes(env.JWT_AUDIENCE);

  if (!claimsValidos) throw new UnauthorizedError();
}
