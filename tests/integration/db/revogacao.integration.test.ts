import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { prisma } from '../../../src/persistence/prisma.js';
import { TokenRevogadoRepository } from '../../../src/repositories/token-revogado.repository.js';
import { UsuarioRepository } from '../../../src/repositories/usuario.repository.js';
import { PapelUsuario } from '../../../src/domain/shared/enums.js';

describe('Integração PostgreSQL Real — Revogação de JWT e TokenRevogado (TASK-08 / S1)', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  beforeEach(async () => {
    await prisma.tokenRevogado.deleteMany();
    await prisma.usuario.deleteMany();
  });

  afterAll(async () => {
    await prisma.tokenRevogado.deleteMany();
    await prisma.usuario.deleteMany();
    await prisma.$disconnect();
  });

  it('persiste TokenRevogado na tabela do PostgreSQL com chave primária jti', async () => {
    const expiresAt = new Date(Date.now() + 3600000);
    const jti = 'jti-postgres-real-1';

    const criado = await TokenRevogadoRepository.criar({
      jti,
      expiresAt,
      motivo: 'LOGOUT',
    });

    expect(criado.jti).toBe(jti);
    expect(criado.motivo).toBe('LOGOUT');

    const revogado = await TokenRevogadoRepository.isRevogado(jti);
    expect(revogado).toBe(true);

    const naoRevogado = await TokenRevogadoRepository.isRevogado('jti-inexistente');
    expect(naoRevogado).toBe(false);
  });

  it('limparExpirados remove apenas registros cuja data expiresAt seja anterior ao instante de corte', async () => {
    const agora = new Date();
    const expirado = new Date(agora.getTime() - 10000);
    const valido = new Date(agora.getTime() + 60000);

    await TokenRevogadoRepository.criar({
      jti: 'jti-expirado',
      expiresAt: expirado,
      motivo: 'LOGOUT',
    });

    await TokenRevogadoRepository.criar({
      jti: 'jti-valido',
      expiresAt: valido,
      motivo: 'LOGOUT',
    });

    const removidos = await TokenRevogadoRepository.limparExpirados(agora);
    expect(removidos).toBe(1);

    expect(await TokenRevogadoRepository.isRevogado('jti-expirado')).toBe(false);
    expect(await TokenRevogadoRepository.isRevogado('jti-valido')).toBe(true);
  });

  it('atualiza tokensValidosApos no Usuario no PostgreSQL real', async () => {
    const usuario = await UsuarioRepository.create({
      usuario: 'user.revogacao',
      hashSenha: '$2b$12$somehashforrealdatabasetest000000000000000000000000',
      papel: PapelUsuario.OPERADOR_CADASTRO,
    });

    expect(usuario.tokensValidosApos).toBeNull();

    const dataCorte = new Date();
    const atualizado = await UsuarioRepository.update(usuario.id, {
      tokensValidosApos: dataCorte,
    });

    expect(atualizado.tokensValidosApos).toBeDefined();
    expect(atualizado.tokensValidosApos?.getTime()).toBe(dataCorte.getTime());
  });
});
