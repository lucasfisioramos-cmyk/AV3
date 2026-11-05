import bcrypt from 'bcrypt';

/** Custo do bcrypt (2^12 iterações). Hashes com custo menor são regravados no próximo login. */
export const BCRYPT_COST = 12;

/**
 * O bcrypt gera o salt internamente e o embute no próprio hash
 * (`$2b$<custo>$<salt+hash>`), então NÃO existe salt para armazenar separadamente.
 * Guardar apenas esta string é a forma esperada de usar a biblioteca.
 */
export class PasswordHasher {
  private static hashFalso: Promise<string> | undefined;

  static hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_COST);
  }

  static comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /** Verdadeiro quando o hash foi gerado com um custo menor que o atual (ou formato desconhecido). */
  static precisaRehash(hash: string): boolean {
    const custo = /^\$2[abxy]\$(\d{2})\$/.exec(hash)?.[1];
    return custo === undefined || Number(custo) < BCRYPT_COST;
  }

  /**
   * Executa uma comparação "no vazio" para que login de usuário inexistente
   * leve o mesmo tempo que login com senha errada (evita enumeração de usuários por tempo).
   */
  static async simularComparacao(password: string): Promise<void> {
    this.hashFalso ??= bcrypt.hash('hash-falso-para-igualar-tempo', BCRYPT_COST);
    await bcrypt.compare(password, await this.hashFalso);
  }
}
