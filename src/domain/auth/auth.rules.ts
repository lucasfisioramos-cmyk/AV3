import { RegraDeNegocioError, UnauthorizedError } from '../../errors/app-error.js';

export const AuthRules = {
  exigirCredenciaisPreenchidas(usuario?: string, senha?: string): void {
    if (!usuario || !senha) throw new RegraDeNegocioError('Usuário e senha são obrigatórios.');
  },

  /** Mensagem única para usuário inexistente e senha incorreta (não revela qual falhou). */
  credenciaisInvalidas(): UnauthorizedError {
    return new UnauthorizedError('Credenciais inválidas.');
  },
};
