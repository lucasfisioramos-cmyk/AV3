import bcrypt from 'bcrypt';
import { describe, expect, it } from 'vitest';
import { BCRYPT_COST, PasswordHasher } from '../../../src/security/hasher.js';

describe('PasswordHasher', () => {
  it('retorna uma única string bcrypt com o custo e o salt embutidos (sem salt separado)', async () => {
    const hash = await PasswordHasher.hashPassword('Senha#Forte1');
    expect(typeof hash).toBe('string');
    expect(hash).toMatch(new RegExp(`^\\$2[aby]\\$${BCRYPT_COST}\\$[./A-Za-z0-9]{53}$`));
  });

  it('gera hashes diferentes para a mesma senha (salt aleatório interno)', async () => {
    const [a, b] = await Promise.all([PasswordHasher.hashPassword('Senha#Forte1'), PasswordHasher.hashPassword('Senha#Forte1')]);
    expect(a).not.toBe(b);
  });

  it('nunca contém a senha em texto puro', async () => {
    expect(await PasswordHasher.hashPassword('Senha#Forte1')).not.toContain('Senha#Forte1');
  });

  it('compara corretamente senha certa e errada', async () => {
    const hash = await PasswordHasher.hashPassword('Senha#Forte1');
    expect(await PasswordHasher.comparePassword('Senha#Forte1', hash)).toBe(true);
    expect(await PasswordHasher.comparePassword('senha#forte1', hash)).toBe(false);
    expect(await PasswordHasher.comparePassword('', hash)).toBe(false);
  });

  it('continua validando hashes antigos (custo 10) e indica que precisam de rehash', async () => {
    const antigo = await bcrypt.hash('Senha#Forte1', 10);
    expect(await PasswordHasher.comparePassword('Senha#Forte1', antigo)).toBe(true);
    expect(PasswordHasher.precisaRehash(antigo)).toBe(true);
  });

  it('não pede rehash para hash com o custo atual; formato desconhecido pede', async () => {
    expect(PasswordHasher.precisaRehash(await PasswordHasher.hashPassword('x'))).toBe(false);
    expect(PasswordHasher.precisaRehash('not-a-bcrypt-hash')).toBe(true);
  });

  it('simularComparacao executa sem erro e leva tempo de um bcrypt real (anti-enumeração)', async () => {
    await PasswordHasher.simularComparacao('qualquer'); // aquece o hash falso
    const inicio = performance.now();
    await PasswordHasher.simularComparacao('qualquer');
    expect(performance.now() - inicio).toBeGreaterThan(20);
  });
});
