import { PrismaClientInitializationError, PrismaClientKnownRequestError, PrismaClientValidationError } from '@prisma/client/runtime/library';
import { describe, expect, it } from 'vitest';
import { ConflictError, ForbiddenError, NotFoundError, RegraDeNegocioError, UnauthorizedError } from '../../../src/errors/app-error.js';
import { erroParaLog, mapError } from '../../../src/errors/error-mapper.js';

const prisma = (code: string, meta?: Record<string, unknown>) => new PrismaClientKnownRequestError('SELECT * FROM x WHERE hash = $2a$12$segredo', { code, clientVersion: 't', meta });

describe('mapError', () => {
  it.each([
    [new RegraDeNegocioError('r'), 400],
    [new UnauthorizedError(), 401],
    [new ForbiddenError('f'), 403],
    [new NotFoundError('n'), 404],
    [new ConflictError('c'), 409],
  ])('AppError %# -> %i com a própria mensagem', (erro, status) => {
    expect(mapError(erro)).toMatchObject({ statusCode: status, message: erro.message, shouldLogAsError: false });
  });

  it.each([
    ['P2002', 409], ['P2025', 404], ['P2003', 409], ['P2034', 409], ['P2000', 400],
    ['P1001', 503], ['P1002', 503], ['P1008', 503], ['P1017', 503], ['P9999', 500],
  ])('Prisma %s -> %i, sem vazar a mensagem original', (code, status) => {
    const m = mapError(prisma(code, { target: ['usuario'] }));
    expect(m.statusCode).toBe(status);
    expect(m.message).not.toMatch(/SELECT|segredo|\$2a/);
  });

  it('P2002 informa os campos; sem meta, mensagem genérica', () => {
    expect(mapError(prisma('P2002', { target: ['a', 'b'] })).message).toContain('a, b');
    expect(mapError(prisma('P2002', { target: 'cnpj' })).message).toContain('cnpj');
    expect(mapError(prisma('P2002')).message).toBe('Registro duplicado.');
  });

  it('erros de validação/inicialização do Prisma', () => {
    expect(mapError(new PrismaClientValidationError('x', { clientVersion: 't' })).statusCode).toBe(400);
    expect(mapError(new PrismaClientInitializationError('x', 't')).statusCode).toBe(503);
  });

  it('issues de validação viram detalhes por campo', () => {
    const m = mapError({ validation: [{ instancePath: '/a/b', message: 'ruim' }, { params: { missingProperty: 'c' } }], validationContext: 'body' });
    expect(m.statusCode).toBe(400);
    expect(m.details).toEqual([
      { local: 'body', campo: 'a.b', mensagem: 'ruim' },
      { local: 'body', campo: 'c', mensagem: 'Valor inválido.' },
    ]);
  });

  it('erros 4xx do Fastify mantêm o status; FST_JWT_* vira 401 genérico', () => {
    expect(mapError({ statusCode: 413, message: 'grande' })).toMatchObject({ statusCode: 413, message: 'grande' });
    expect(mapError({ statusCode: 400, code: 'FST_JWT_NO_AUTHORIZATION_IN_HEADER', message: 'detalhe interno' })).toMatchObject({ statusCode: 401, message: expect.not.stringContaining('interno') });
  });

  it('qualquer outro erro vira 500 genérico e é logado como erro', () => {
    const m = mapError(new Error('boom com segredo'));
    expect(m).toMatchObject({ statusCode: 500, message: 'Ocorreu um erro interno no servidor.', shouldLogAsError: true });
    expect(mapError('texto')).toMatchObject({ statusCode: 500 });
    expect(mapError({ statusCode: 502, message: 'x' }).statusCode).toBe(500);
  });
});

describe('erroParaLog', () => {
  it('erros do Prisma: somente tipo e código (a mensagem carrega a consulta e valores)', () => {
    const l = erroParaLog(prisma('P2002'));
    expect(l).toEqual({ name: 'PrismaClientKnownRequestError', code: 'P2002' });
    expect(JSON.stringify(l)).not.toMatch(/segredo|SELECT/);
    expect(erroParaLog(new PrismaClientInitializationError('x', 't', 'P1001'))).toMatchObject({ code: 'P1001' });
    expect(erroParaLog(new PrismaClientValidationError('x', { clientVersion: 't' }))).toEqual({ name: 'PrismaClientValidationError' });
  });

  it('Error comum inclui stack; valor desconhecido é anonimizado', () => {
    expect(erroParaLog(new Error('x'))).toMatchObject({ name: 'Error', message: 'x', stack: expect.any(String) });
    expect(erroParaLog(42)).toEqual({ name: 'UnknownError' });
  });
});
