import { createHmac } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { env } from '../../src/config/env.js';
import { fecharApp, obterApp } from '../helpers/app.js';
import { db } from '../helpers/fakes.js';

afterAll(fecharApp);

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
function forjar(payload: Record<string, unknown>, { alg = 'HS256', segredo = env.JWT_SECRET }: { alg?: string; segredo?: string } = {}) {
  const corpo = `${b64({ alg, typ: 'JWT' })}.${b64(payload)}`;
  const algoritmo = alg === 'HS512' ? 'sha512' : 'sha256';
  return `${corpo}.${createHmac(algoritmo, segredo).update(corpo).digest('base64url')}`;
}

async function acessar(token?: string) {
  const app = await obterApp();
  return app.inject({ method: 'GET', url: '/api/v1/relatorios/status', headers: token ? { authorization: `Bearer ${token}` } : {} });
}

describe('validação do JWT (tokens forjados ou inválidos -> 401)', () => {
  const agora = () => Math.floor(Date.now() / 1000);
  const base = (id: string) => ({
    sub: id,
    usuario: 'adm',
    papel: 'ADMINISTRADOR',
    jti: '00000000-0000-4000-8000-000000000001',
    iss: env.JWT_ISSUER,
    aud: env.JWT_AUDIENCE,
    iat: agora(),
    exp: agora() + 600,
  });

  it('o token forjado "bem formado" com o segredo correto é aceito (controle do teste)', async () => {
    const u = await db.semear.usuario({ papel: 'ADMINISTRADOR' });
    expect((await acessar(forjar(base(u.id)))).statusCode).toBe(200);
  });

  it.each([
    ['sem cabeçalho', undefined],
    ['lixo', 'abc'],
    ['três partes inválidas', 'a.b.c'],
  ])('401: %s', async (_n, token) => {
    expect((await acessar(token)).statusCode).toBe(401);
  });

  it('401: assinatura com outro segredo', async () => {
    const u = await db.semear.usuario({ papel: 'ADMINISTRADOR' });
    expect((await acessar(forjar(base(u.id), { segredo: 'outro-segredo-completamente-diferente-123' }))).statusCode).toBe(401);
  });

  it('401: payload adulterado mantendo a assinatura original', async () => {
    const u = await db.semear.usuario({ papel: 'AUDITOR' });
    const [h, , s] = forjar({ ...base(u.id), papel: 'AUDITOR' }).split('.');
    const adulterado = `${h}.${b64({ ...base(u.id), papel: 'ADMINISTRADOR' })}.${s}`;
    expect((await acessar(adulterado)).statusCode).toBe(401);
  });

  it('401: token expirado', async () => {
    const u = await db.semear.usuario({ papel: 'ADMINISTRADOR' });
    expect((await acessar(forjar({ ...base(u.id), exp: agora() - 10 }))).statusCode).toBe(401);
  });

  it('401: token sem exp (nunca expira)', async () => {
    const u = await db.semear.usuario({ papel: 'ADMINISTRADOR' });
    const { exp: _exp, ...semExp } = base(u.id);
    expect((await acessar(forjar(semExp))).statusCode).toBe(401);
  });

  it.each([
    ['iss errado', { iss: 'outro' }],
    ['aud errado', { aud: 'outro' }],
    ['sem iss', { iss: undefined }],
    ['sem aud', { aud: undefined }],
    ['sem sub', { sub: undefined }],
    ['sem usuario', { usuario: undefined }],
    ['sem jti', { jti: undefined }],
    ['papel inexistente', { papel: 'ROOT' }],
    ['sem papel', { papel: undefined }],
  ])('401: %s', async (_n, alteracao) => {
    const u = await db.semear.usuario({ papel: 'ADMINISTRADOR' });
    expect((await acessar(forjar({ ...base(u.id), ...alteracao }))).statusCode).toBe(401);
  });

  it('401: algoritmo trocado (HS512) e "alg: none"', async () => {
    const u = await db.semear.usuario({ papel: 'ADMINISTRADOR' });
    expect((await acessar(forjar(base(u.id), { alg: 'HS512' }))).statusCode).toBe(401);
    const none = `${b64({ alg: 'none', typ: 'JWT' })}.${b64(base(u.id))}.`;
    expect((await acessar(none)).statusCode).toBe(401);
  });

  it('a resposta 401 é genérica (não revela o motivo)', async () => {
    const u = await db.semear.usuario({ papel: 'ADMINISTRADOR' });
    const a = await acessar(forjar({ ...base(u.id), exp: agora() - 10 }));
    const b = await acessar('lixo');
    expect(a.json()).toEqual(b.json());
  });
});
