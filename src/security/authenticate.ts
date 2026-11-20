import type { FastifyRequest } from 'fastify';
import { PapelUsuario } from '../domain/shared/enums.js';
import { env } from '../config/env.js';
import { UnauthorizedError } from '../errors/app-error.js';
import { TokenRevogadoRepository } from '../repositories/token-revogado.repository.js';
import { UsuarioRepository } from '../repositories/usuario.repository.js';

const PAPEIS_VALIDOS: readonly string[] = Object.values(PapelUsuario);

const ehTextoNaoVazio = (valor: unknown): valor is string => typeof valor === 'string' && valor.trim() !== '';

/**
 * Hook de autenticação. O plugin valida assinatura, algoritmo e `exp`/`iss`/`aud` QUANDO presentes;
 * aqui exigimos que TODOS os claims esperados existam e tenham o valor correto
 * (um token sem `iss`/`aud`/`exp`/`jti`/`iat` nunca é aceito).
 * Também verifica se o token foi revogado e se o usuário está ativo com sessão válida.
 * Qualquer falha vira 401 genérico (o motivo não é revelado ao cliente).
 */
export async function authenticate(request: FastifyRequest): Promise<void> {
  try {
    await request.jwtVerify();
  } catch {
    throw new UnauthorizedError();
  }

  const { sub, usuario, papel, exp, iss, aud, jti, iat } = request.user;
  const audiencias = Array.isArray(aud) ? aud : [aud];
  const claimsValidos =
    ehTextoNaoVazio(sub) &&
    ehTextoNaoVazio(usuario) &&
    ehTextoNaoVazio(jti) &&
    PAPEIS_VALIDOS.includes(papel) &&
    typeof exp === 'number' &&
    typeof iat === 'number' &&
    iss === env.JWT_ISSUER &&
    audiencias.includes(env.JWT_AUDIENCE);

  if (!claimsValidos) throw new UnauthorizedError();

  const revogado = await TokenRevogadoRepository.isRevogado(jti);
  if (revogado) throw new UnauthorizedError();

  const usuarioDb = await UsuarioRepository.findById(sub);
  if (!usuarioDb) throw new UnauthorizedError();

  if (usuarioDb.tokensValidosApos) {
    const tokensValidosAposSec = Math.floor(usuarioDb.tokensValidosApos.getTime() / 1000);
    if (iat < tokensValidosAposSec) {
      throw new UnauthorizedError();
    }
  }
}
