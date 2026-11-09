import { afterAll, describe, expect, it } from 'vitest';
import { fecharApp, obterApp } from '../helpers/app.js';
import { db, SENHA_TESTE } from '../helpers/fakes.js';

afterAll(fecharApp);

const login = async (corpo: unknown) =>
  (await obterApp()).inject({ method: 'POST', url: '/api/v1/auth/login', payload: corpo as object });

describe('POST /api/v1/auth/login', () => {
  it('200: devolve token JWT, usuário e papel no envelope padrão, sem dados sensíveis', async () => {
    await db.semear.usuario({ usuario: 'maria', papel: 'AUDITOR' });
    const res = await login({ usuario: 'maria', senha: SENHA_TESTE });
    expect(res.statusCode).toBe(200);
    const { data } = res.json();
    expect(data).toMatchObject({ usuario: 'maria', papel: 'AUDITOR' });
    expect(data.token.split('.')).toHaveLength(3);
    expect(res.body).not.toMatch(/hash|\$2[aby]\$/i);
  });

  it('o token emitido contém sub/usuario/papel/iss/aud/exp e é aceito nas rotas protegidas', async () => {
    const u = await db.semear.usuario({ usuario: 'maria', papel: 'AUDITOR' });
    const app = await obterApp();
    const { data } = (await login({ usuario: 'maria', senha: SENHA_TESTE })).json();
    const claims = app.jwt.decode<Record<string, unknown>>(data.token)!;
    expect(claims).toMatchObject({ sub: u.id, usuario: 'maria', papel: 'AUDITOR', iss: 'greencode-api', aud: 'greencode-clients' });
    expect(typeof claims.exp).toBe('number');
    const r = await app.inject({ method: 'GET', url: '/api/v1/relatorios/status', headers: { authorization: `Bearer ${data.token}` } });
    expect(r.statusCode).toBe(200);
  });

  it('401: senha errada e usuário inexistente têm resposta idêntica', async () => {
    await db.semear.usuario({ usuario: 'maria' });
    const [a, b] = await Promise.all([login({ usuario: 'maria', senha: 'Errada#123x' }), login({ usuario: 'fantasma', senha: 'Errada#123x' })]);
    expect(a.statusCode).toBe(401);
    expect(b.statusCode).toBe(401);
    expect(a.json()).toEqual(b.json());
    expect(a.json()).toMatchObject({ statusCode: 401, error: 'Unauthorized', message: 'Credenciais inválidas.' });
  });

  it.each([{}, { usuario: 'x' }, { senha: 'x' }, { usuario: '', senha: 'x' }, { usuario: '  ', senha: 'x' }, { usuario: 1, senha: 2 }])(
    '400: corpo inválido %j com detalhes por campo',
    async (corpo) => {
      const res = await login(corpo);
      expect(res.statusCode).toBe(400);
      expect(res.json().details?.length).toBeGreaterThan(0);
    }
  );

  it('a resposta de erro nunca expõe stack nem a senha enviada', async () => {
    const res = await login({ usuario: 'maria', senha: 'SegredoQueNaoDeveVazar#1' });
    expect(res.body).not.toContain('SegredoQueNaoDeveVazar#1');
    expect(res.body).not.toMatch(/stack|node_modules/);
  });
});
