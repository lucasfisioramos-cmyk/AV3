import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { PapelUsuario } from '../../src/domain/shared/enums.js';
import type { JwtClaims } from '../../src/types/auth.js';

let instancia: FastifyInstance | undefined;

/** Aplicação real (rotas, validação, JWT, handler de erros) pronta para `inject`. */
export async function obterApp(): Promise<FastifyInstance> {
  if (!instancia) {
    const { app } = await import('../../src/app.js');
    await app.ready();
    instancia = app;
  }
  return instancia;
}

export async function fecharApp(): Promise<void> {
  await instancia?.close();
  instancia = undefined;
}

export async function tokenPara(
  usuario: { id: string; usuario: string; papel: PapelUsuario },
  claimsExtras?: Partial<JwtClaims>
): Promise<string> {
  const app = await obterApp();
  return app.jwt.sign({
    sub: usuario.id,
    usuario: usuario.usuario,
    papel: usuario.papel,
    jti: randomUUID(),
    ...claimsExtras,
  } satisfies JwtClaims);
}

export async function autenticado(
  usuario: { id: string; usuario: string; papel: PapelUsuario },
  claimsExtras?: Partial<JwtClaims>
) {
  return { authorization: `Bearer ${await tokenPara(usuario, claimsExtras)}` };
}
