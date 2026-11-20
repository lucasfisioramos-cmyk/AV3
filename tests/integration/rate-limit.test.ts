import { afterAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';
import { db, SENHA_TESTE } from '../helpers/fakes.js';

describe('Rate Limiting — Proteção contra Brute-Force e Abuso da API (S2)', () => {
  it('deve bloquear a 6ª tentativa consecutiva de login para o mesmo IP com status 429 e envelope padronizado', async () => {
    const testApp = buildApp({
      rateLimit: {
        loginMax: 5,
        loginTimeWindow: '1 minute',
      },
    });
    await testApp.ready();

    await db.semear.usuario({ usuario: 'vitima_bruteforce', papel: 'OPERADOR_CADASTRO' });

    const clientIp = '198.51.100.1';
    const payload = { usuario: 'vitima_bruteforce', senha: 'SenhaErrada#999' };

    // As 5 primeiras tentativas são processadas normalmente (retornando 401 por credencial errada)
    for (let i = 1; i <= 5; i++) {
      const res = await testApp.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        remoteAddress: clientIp,
        payload,
      });
      expect(res.statusCode).toBe(401);
    }

    // A 6ª tentativa consecutiva deve ser bloqueada pelo rate limit
    const resBloqueada = await testApp.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      remoteAddress: clientIp,
      payload,
    });

    expect(resBloqueada.statusCode).toBe(429);
    expect(resBloqueada.json()).toMatchObject({
      statusCode: 429,
      error: 'Too Many Requests',
      message: expect.stringContaining('Taxa limite de requisições excedida'),
    });

    // Requisição com IP diferente não deve ser afetada pelo bloqueio do IP anterior
    const resOutroIp = await testApp.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      remoteAddress: '198.51.100.2',
      payload: { usuario: 'vitima_bruteforce', senha: SENHA_TESTE },
    });
    expect(resOutroIp.statusCode).toBe(200);

    await testApp.close();
  });

  it('deve aplicar rate limit global às demais rotas da API no envelope padrão', async () => {
    const testApp = buildApp({
      rateLimit: {
        globalMax: 3,
        globalTimeWindow: '1 minute',
      },
    });
    await testApp.ready();

    const clientIp = '198.51.100.50';

    // 3 requisições permitidas
    for (let i = 1; i <= 3; i++) {
      const res = await testApp.inject({
        method: 'GET',
        url: '/api/v1/health',
        remoteAddress: clientIp,
      });
      expect(res.statusCode).toBe(200);
    }

    // 4ª requisição deve ser rejeitada com 429
    const resBloqueada = await testApp.inject({
      method: 'GET',
      url: '/api/v1/health',
      remoteAddress: clientIp,
    });

    expect(resBloqueada.statusCode).toBe(429);
    expect(resBloqueada.json()).toMatchObject({
      statusCode: 429,
      error: 'Too Many Requests',
      message: expect.stringContaining('Taxa limite de requisições excedida'),
    });

    await testApp.close();
  });
});
