import { Writable } from 'node:stream';
import pino from 'pino';
import { describe, expect, it } from 'vitest';
import { loggerOptions } from '../../../src/config/logger.js';

function registrar(objeto: object) {
  let saida = '';
  const destino = new Writable({ write(chunk, _e, cb) { saida += chunk.toString(); cb(); } });
  const { transport: _t, level: _l, ...opcoes } = loggerOptions as Record<string, unknown>;
  pino({ ...opcoes, level: 'info' }, destino).info(objeto, 'teste');
  return saida;
}

describe('logger: dados sensíveis', () => {
  it('censura credenciais e tokens, mesmo aninhados', () => {
    const linha = registrar({ senha: 'segredo-um', novaSenha: 'segredo-dois', hashSenha: '$2b$12$abc', token: 'token-secreto', body: { senhaPlana: 'segredo-tres', password: 'segredo-quatro' }, req: { headers: { authorization: 'Bearer XYZ', cookie: 'c=1' } } });
    for (const segredo of ['segredo-um', 'segredo-dois', 'segredo-tres', 'segredo-quatro', '$2b$12$abc', 'token-secreto', 'Bearer XYZ', 'c=1']) expect(linha).not.toContain(segredo);
    expect(linha).toContain('[REDACTED]');
  });

  it('o serializador de requisição não registra query string, headers nem corpo', () => {
    const serializar = (loggerOptions as { serializers: { req: (r: object) => object } }).serializers.req;
    const r = serializar({ method: 'GET', url: '/x?token=abc', ip: '1.2.3.4', headers: { authorization: 'Bearer X' }, body: { senha: 'x' } });
    expect(r).toEqual({ method: 'GET', url: '/x', remoteAddress: '1.2.3.4' });
  });
});
