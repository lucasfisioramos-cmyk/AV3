import { describe, expect, it } from 'vitest';
import { POLITICA_SENHA, validarSenha } from '../../../src/domain/validators/senha.js';

describe('validarSenha (política de senha forte)', () => {
  it.each(['Senha#Forte1', 'Greencode#Dev2026', 'Ab#12345', 'ÁguaÇão#2026', 'Com espaço#9A'])('aceita %s', (senha) => {
    expect(validarSenha(senha)).toEqual({ valido: true });
  });

  it.each([
    ['Ab#1', 'no mínimo 8 caracteres'],
    ['semmaiuscula1!', 'uma letra maiúscula'],
    ['SEMMINUSCULA1!', 'uma letra minúscula'],
    ['SemNumero!!', 'um número'],
    ['SemSimbolo123', 'um símbolo'],
  ])('rejeita %s (falta: %s)', (senha, falta) => {
    const r = validarSenha(senha);
    expect(r.valido).toBe(false);
    expect(r).toMatchObject({ mensagem: expect.stringContaining(falta) });
  });

  it('lista todos os requisitos não atendidos', () => {
    const r = validarSenha('abc');
    expect(r).toMatchObject({ valido: false });
    if (!r.valido) {
      for (const parte of ['8 caracteres', 'maiúscula', 'número', 'símbolo']) expect(r.mensagem).toContain(parte);
    }
  });

  it('respeita o limite de 72 BYTES do bcrypt (não 72 caracteres)', () => {
    expect(validarSenha('Aa1!' + 'a'.repeat(68)).valido).toBe(true);
    expect(validarSenha('Aa1!' + 'a'.repeat(69)).valido).toBe(false);
    // 4 + 35 caracteres "é" (2 bytes cada) = 74 bytes
    expect(validarSenha('Aa1!' + 'é'.repeat(35)).valido).toBe(false);
    expect(POLITICA_SENHA.maximoBytes).toBe(72);
  });

  it('rejeita senha que contém o nome de usuário (sem diferenciar maiúsculas)', () => {
    expect(validarSenha('Maria#2026x', { usuario: 'maria' })).toEqual({
      valido: false,
      mensagem: 'A senha não pode conter o nome de usuário.',
    });
    expect(validarSenha('MARIA#2026x', { usuario: 'Maria' }).valido).toBe(false);
  });

  it('ignora nomes de usuário muito curtos (evita falsos positivos)', () => {
    expect(validarSenha('Ab#12345xy', { usuario: 'ab' }).valido).toBe(true);
  });

  it.each(['Admin123!', 'Senha@123', 'Welcome1!', 'P@ssw0rd'])('rejeita senha comum (%s)', (senha) => {
    expect(validarSenha(senha)).toEqual({ valido: false, mensagem: 'Essa senha é muito comum. Escolha outra.' });
  });
});
