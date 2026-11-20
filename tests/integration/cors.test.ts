import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';

describe('CORS dinâmico por ambiente (S4)', () => {
  it('preflight OPTIONS para origem permitida responde 204 com headers adequados', async () => {
    const testApp = buildApp({
      cors: {
        origins: ['https://app.greencode.com.br', 'https://admin.greencode.com.br'],
      },
    });
    await testApp.ready();

    const res = await testApp.inject({
      method: 'OPTIONS',
      url: '/api/v1/health',
      headers: {
        origin: 'https://app.greencode.com.br',
        'access-control-request-method': 'GET',
      },
    });

    expect(res.statusCode).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('https://app.greencode.com.br');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
    expect(res.headers['access-control-allow-methods']).toContain('GET');
    expect(res.headers['access-control-allow-methods']).toContain('POST');
    expect(res.headers['access-control-allow-methods']).toContain('PATCH');
    expect(res.headers['access-control-allow-methods']).toContain('DELETE');

    await testApp.close();
  });

  it('requisição normal com origem permitida recebe Access-Control-Allow-Origin', async () => {
    const testApp = buildApp({
      cors: {
        origins: ['https://app.greencode.com.br'],
      },
    });
    await testApp.ready();

    const res = await testApp.inject({
      method: 'GET',
      url: '/api/v1/health',
      headers: {
        origin: 'https://app.greencode.com.br',
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('https://app.greencode.com.br');
    expect(res.headers['access-control-allow-credentials']).toBe('true');

    await testApp.close();
  });

  it('origem não listada é bloqueada (sem header Access-Control-Allow-Origin)', async () => {
    const testApp = buildApp({
      cors: {
        origins: ['https://app.greencode.com.br'],
      },
    });
    await testApp.ready();

    // 1. Preflight com origem não autorizada
    const resPreflight = await testApp.inject({
      method: 'OPTIONS',
      url: '/api/v1/health',
      headers: {
        origin: 'https://malicioso.com',
        'access-control-request-method': 'POST',
      },
    });

    expect(resPreflight.headers['access-control-allow-origin']).toBeUndefined();

    // 2. Requisição normal com origem não autorizada não recebe allow-origin
    const resNormal = await testApp.inject({
      method: 'GET',
      url: '/api/v1/health',
      headers: {
        origin: 'https://malicioso.com',
      },
    });

    expect(resNormal.headers['access-control-allow-origin']).toBeUndefined();

    await testApp.close();
  });

  it('fora de produção com wildcard permite qualquer origem e reflete no header', async () => {
    const testApp = buildApp({
      cors: {
        origins: ['*'],
      },
    });
    await testApp.ready();

    const res = await testApp.inject({
      method: 'GET',
      url: '/api/v1/health',
      headers: {
        origin: 'http://localhost:5173',
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');

    await testApp.close();
  });
});
