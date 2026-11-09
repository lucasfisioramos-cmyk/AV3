import { afterAll, describe, expect, it } from 'vitest';
import { PapelUsuario } from '../../src/domain/shared/enums.js';
import { autenticado, fecharApp, obterApp } from '../helpers/app.js';
import { db } from '../helpers/fakes.js';

afterAll(fecharApp);

const { ADMINISTRADOR: ADM, OPERADOR_CADASTRO: OP, GESTOR_ALMOXARIFADO: GA, AUDITOR: AUD } = PapelUsuario;
const ID = '00000000-0000-4000-8000-000000000000';

/**
 * Matriz papel x rota. "permitidos" = papéis que PASSAM pela autorização (o resultado de negócio pode
 * ser 400/404 porque os dados são fictícios); os demais devem receber exatamente 403.
 */
// PUT /usuarios/:id tem regra própria no serviço (admin ou o próprio usuário): coberto em usuarios.test.ts.
const ROTAS: { metodo: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; url: string; permitidos: PapelUsuario[] }[] = [
  { metodo: 'POST', url: '/api/v1/usuarios', permitidos: [ADM] },
  { metodo: 'DELETE', url: `/api/v1/usuarios/${ID}`, permitidos: [ADM] },
  { metodo: 'GET', url: '/api/v1/organizacoes', permitidos: [ADM, OP, GA, AUD] },
  { metodo: 'POST', url: '/api/v1/organizacoes', permitidos: [ADM, OP] },
  { metodo: 'GET', url: '/api/v1/lotes', permitidos: [ADM, OP, GA, AUD] },
  { metodo: 'POST', url: '/api/v1/lotes', permitidos: [ADM, GA] },
  { metodo: 'POST', url: '/api/v1/equipamentos', permitidos: [ADM, OP, GA] },
  { metodo: 'PATCH', url: `/api/v1/equipamentos/${ID}/movimentar`, permitidos: [ADM, OP, GA] },
  { metodo: 'PATCH', url: `/api/v1/equipamentos/${ID}/estado-fisico`, permitidos: [ADM, OP, GA] },
  { metodo: 'GET', url: '/api/v1/relatorios/status', permitidos: [ADM, GA, AUD] },
  { metodo: 'GET', url: `/api/v1/relatorios/organizacao/${ID}`, permitidos: [ADM, GA, AUD] },
];

const casos = ROTAS.flatMap((r) =>
  Object.values(PapelUsuario).map((papel) => ({ ...r, papel, deveNegar: !r.permitidos.includes(papel) }))
);

describe('autorização por papel (matriz completa papel x rota)', () => {
  it.each(casos.filter((c) => c.deveNegar))('403: $papel em $metodo $url', async ({ metodo, url, papel }) => {
    const usuario = await db.semear.usuario({ papel });
    const res = await (await obterApp()).inject({ method: metodo, url, headers: await autenticado(usuario), payload: metodo === 'GET' ? undefined : {} });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ statusCode: 403, error: 'Forbidden' });
  });

  it.each(casos.filter((c) => !c.deveNegar))('NÃO é 401/403: $papel em $metodo $url', async ({ metodo, url, papel }) => {
    const usuario = await db.semear.usuario({ papel });
    const res = await (await obterApp()).inject({ method: metodo, url, headers: await autenticado(usuario), payload: metodo === 'GET' ? undefined : {} });
    expect([401, 403]).not.toContain(res.statusCode);
  });

  it.each(ROTAS)('401: sem token em $metodo $url', async ({ metodo, url }) => {
    const res = await (await obterApp()).inject({ method: metodo, url, payload: metodo === 'GET' ? undefined : {} });
    expect(res.statusCode).toBe(401);
  });

  it('rotas públicas: health e login dispensam token', async () => {
    const app = await obterApp();
    expect((await app.inject({ method: 'GET', url: '/api/v1/health' })).statusCode).toBeLessThan(500);
    expect((await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: {} })).statusCode).toBe(400);
  });
});
