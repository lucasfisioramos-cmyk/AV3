import { describe, expect, it } from 'vitest';
import { PapelUsuario } from '../../../src/domain/shared/enums.js';
import { validarEmail } from '../../../src/domain/validators/email.js';
import { validarPapel } from '../../../src/domain/validators/papel.js';

describe('validarPapel', () => {
  it.each(Object.values(PapelUsuario))('aceita %s', (papel) => {
    expect(validarPapel(papel).valido).toBe(true);
  });

  it.each(['ROOT', 'administrador', '', 1, null, undefined, {}])('rejeita %j', (papel) => {
    const r = validarPapel(papel);
    expect(r.valido).toBe(false);
    if (!r.valido) expect(r.mensagem).toContain('ADMINISTRADOR');
  });
});

describe('validarEmail', () => {
  it.each(['a@b.com', 'maria.silva+tag@empresa.com.br', ' contato@reciclatech.com '])('aceita %s', (email) => {
    expect(validarEmail(email).valido).toBe(true);
  });

  it.each(['', 'sem-arroba', 'a@b', '@b.com', 'a b@c.com', 'a@b.c', `${'x'.repeat(250)}@b.com`])('rejeita %j', (email) => {
    expect(validarEmail(email)).toEqual({ valido: false, mensagem: 'E-mail em formato inválido.' });
  });
});
