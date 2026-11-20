import { describe, expect, it } from 'vitest';
import { EnvValidationError, parseEnv } from '../../../src/config/env.parser.js';

const ok = { NODE_ENV: 'test', DATABASE_URL: 'postgresql://u:p@localhost:5432/db', JWT_SECRET: 'x' };

describe('parseEnv', () => {
  it('aplica padrões seguros', () => {
    expect(parseEnv(ok)).toMatchObject({ PORT: 3000, HOST: '0.0.0.0', JWT_EXPIRES_IN: '8h', JWT_ISSUER: 'greencode-api', JWT_AUDIENCE: 'greencode-clients', LOG_LEVEL: 'silent' });
    expect(parseEnv({ ...ok, NODE_ENV: 'production', JWT_SECRET: 's'.repeat(32), CORS_ORIGINS: 'https://app.greencode.com.br' }).LOG_LEVEL).toBe('info');
    expect(parseEnv({ ...ok, NODE_ENV: 'development' }).LOG_LEVEL).toBe('debug');
  });

  it('em produção exige JWT_SECRET com 32+ caracteres', () => {
    expect(() => parseEnv({ ...ok, NODE_ENV: 'production', CORS_ORIGINS: 'https://app.greencode.com.br' })).toThrow(/32 caracteres/);
    expect(() => parseEnv({ ...ok, NODE_ENV: 'production', JWT_SECRET: 's'.repeat(32), CORS_ORIGINS: 'https://app.greencode.com.br' })).not.toThrow();
  });

  it('em produção exige CORS_ORIGINS e rejeita "*"', () => {
    expect(() => parseEnv({ ...ok, NODE_ENV: 'production', JWT_SECRET: 's'.repeat(32) })).toThrow(/CORS_ORIGINS/);
    expect(() => parseEnv({ ...ok, NODE_ENV: 'production', JWT_SECRET: 's'.repeat(32), CORS_ORIGINS: '*' })).toThrow(/CORS_ORIGINS/);
    expect(
      parseEnv({
        ...ok,
        NODE_ENV: 'production',
        JWT_SECRET: 's'.repeat(32),
        CORS_ORIGINS: 'https://app.greencode.com.br, https://admin.greencode.com.br',
      }).CORS_ORIGINS
    ).toEqual(['https://app.greencode.com.br', 'https://admin.greencode.com.br']);
  });

  it('reúne TODOS os problemas em um único erro', () => {
    try {
      parseEnv({ NODE_ENV: 'x', DATABASE_URL: 'mysql://a', PORT: '99999', LOG_LEVEL: 'ruidoso', JWT_EXPIRES_IN: '10 min' });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(EnvValidationError);
      expect((e as EnvValidationError).issues.length).toBeGreaterThanOrEqual(6);
    }
  });

  it.each([
    [{ NODE_ENV: undefined }, /NODE_ENV é obrigatória/],
    [{ DATABASE_URL: '' }, /DATABASE_URL é obrigatória/],
    [{ JWT_SECRET: '  ' }, /JWT_SECRET é obrigatória/],
    [{ PORT: '0' }, /PORT/],
    [{ PORT: 'abc' }, /PORT/],
    [{ JWT_EXPIRES_IN: '0h' }, /JWT_EXPIRES_IN/],
    [{ RATE_LIMIT_GLOBAL_MAX: '0' }, /RATE_LIMIT_GLOBAL_MAX/],
    [{ RATE_LIMIT_GLOBAL_MAX: '-5' }, /RATE_LIMIT_GLOBAL_MAX/],
    [{ RATE_LIMIT_GLOBAL_MAX: 'abc' }, /RATE_LIMIT_GLOBAL_MAX/],
    [{ RATE_LIMIT_LOGIN_MAX: '0' }, /RATE_LIMIT_LOGIN_MAX/],
    [{ RATE_LIMIT_LOGIN_MAX: '-1' }, /RATE_LIMIT_LOGIN_MAX/],
    [{ RATE_LIMIT_LOGIN_MAX: 'xyz' }, /RATE_LIMIT_LOGIN_MAX/],
  ])('rejeita %j', (alteracao, mensagem) => {
    expect(() => parseEnv({ ...ok, ...alteracao })).toThrow(mensagem);
  });

  it('converte PORT e aceita LOG_LEVEL em qualquer caixa', () => {
    expect(parseEnv({ ...ok, PORT: '8080', LOG_LEVEL: 'DEBUG', JWT_EXPIRES_IN: '15m' })).toMatchObject({ PORT: 8080, LOG_LEVEL: 'debug', JWT_EXPIRES_IN: '15m' });
  });

  it('permite customizar configurações de rate limit', () => {
    const custom = parseEnv({
      ...ok,
      RATE_LIMIT_GLOBAL_MAX: '500',
      RATE_LIMIT_GLOBAL_TIME_WINDOW: '2 minutes',
      RATE_LIMIT_LOGIN_MAX: '10',
      RATE_LIMIT_LOGIN_TIME_WINDOW: '30 seconds',
    });
    expect(custom).toMatchObject({
      RATE_LIMIT_GLOBAL_MAX: 500,
      RATE_LIMIT_GLOBAL_TIME_WINDOW: '2 minutes',
      RATE_LIMIT_LOGIN_MAX: 10,
      RATE_LIMIT_LOGIN_TIME_WINDOW: '30 seconds',
    });
  });
});
