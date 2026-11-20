import type { PapelUsuario } from '../shared/enums.js';
import { UsuarioRepository } from '../../repositories/usuario.repository.js';
import { TokenRevogadoRepository } from '../../repositories/token-revogado.repository.js';
import { PasswordHasher } from '../../security/hasher.js';
import { AuthRules } from './auth.rules.js';

/** Identidade resultante de uma autenticação bem-sucedida (sem dados sensíveis). */
export interface UsuarioAutenticado {
  id: string;
  usuario: string;
  papel: PapelUsuario;
}

export interface RevogarTokenInput {
  jti: string;
  expiresAt: Date;
  motivo?: string;
}

export class AuthService {
  // Transação: NÃO. Leitura + atualização do último acesso (informativa, não crítica).
  static async autenticar(usuario?: string, senha?: string): Promise<UsuarioAutenticado> {
    AuthRules.exigirCredenciaisPreenchidas(usuario, senha);

    const credencial = await UsuarioRepository.findCredencialByUsuario(usuario!);
    if (!credencial) {
      await PasswordHasher.simularComparacao(senha!); // mesmo tempo de resposta de uma senha errada
      throw AuthRules.credenciaisInvalidas();
    }

    const senhaValida = await PasswordHasher.comparePassword(senha!, credencial.hashSenha);
    if (!senhaValida) throw AuthRules.credenciaisInvalidas();

    // Atualização transparente: hashes gerados com custo antigo são regravados com o custo atual.
    await UsuarioRepository.update(credencial.id, {
      ultimoAcesso: new Date(),
      ...(PasswordHasher.precisaRehash(credencial.hashSenha)
        ? { hashSenha: await PasswordHasher.hashPassword(senha!) }
        : {}),
    });

    return { id: credencial.id, usuario: credencial.usuario, papel: credencial.papel };
  }

  // Revoga o token JWT informado gravando seu jti na lista de revogações.
  static async revogarToken(input: RevogarTokenInput): Promise<void> {
    await TokenRevogadoRepository.criar({
      jti: input.jti,
      expiresAt: input.expiresAt,
      motivo: input.motivo ?? 'LOGOUT',
    });
  }

  // Limpa tokens revogados cujo tempo de expiração já passou.
  static async limparTokensExpirados(dataReferencia?: Date): Promise<number> {
    return TokenRevogadoRepository.limparExpirados(dataReferencia);
  }
}
