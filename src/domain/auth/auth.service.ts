import type { PapelUsuario } from '../shared/enums.js';
import { UsuarioRepository } from '../../repositories/usuario.repository.js';
import { PasswordHasher } from '../../security/hasher.js';
import { AuthRules } from './auth.rules.js';

/** Identidade resultante de uma autenticação bem-sucedida (sem dados sensíveis). */
export interface UsuarioAutenticado {
  id: string;
  usuario: string;
  papel: PapelUsuario;
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
}
