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

    const credencial = await UsuarioRepository.findByUsuario(usuario!);
    if (!credencial) throw AuthRules.credenciaisInvalidas();

    const senhaValida = await PasswordHasher.comparePassword(senha!, credencial.hashSenha);
    if (!senhaValida) throw AuthRules.credenciaisInvalidas();

    await UsuarioRepository.updateUltimoAcesso(credencial.id);

    return { id: credencial.id, usuario: credencial.usuario, papel: credencial.papel };
  }
}
