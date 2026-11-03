import { PapelUsuario } from '@prisma/client';
import { UsuarioRepository } from '../../repositories/usuario.repository.js';
import { PasswordHasher } from '../../security/hasher.js';
import { executarEmTransacao } from '../../persistence/transaction.js';
import { exigirEncontrado } from '../shared/guards.js';
import { UsuarioRules } from './usuario.rules.js';

export interface CriarUsuarioInput {
  usuario: string;
  senhaPlana: string;
  papel: PapelUsuario;
}

export interface EditarUsuarioInput {
  idUsuarioAlvo: string;
  idUsuarioExecuto: string;
  novoUsuario?: string;
  novaSenha?: string;
  novoPapel?: PapelUsuario;
}

export class UsuarioService {
  // 1. Criar novo usuário
  // Transação: NÃO. Escrita única; a unicidade é garantida pela constraint do banco
  // (violação -> P2002 -> 409 no handler global).
  static async criarUsuario(data: CriarUsuarioInput) {
    UsuarioRules.exigirPapelValido(data.papel);
    UsuarioRules.exigirSenhaValida(data.senhaPlana);

    const usuarioExistente = await UsuarioRepository.findByUsuario(data.usuario);
    UsuarioRules.garantirUsuarioInedito(data.usuario, usuarioExistente);

    const { hash, salt } = await PasswordHasher.hashPassword(data.senhaPlana);

    return UsuarioRepository.create({
      usuario: data.usuario,
      hashSenha: hash,
      salt,
      papel: data.papel,
    });
  }

  // 2. Editar usuário
  static async editarUsuario(params: EditarUsuarioInput) {
    const executor = exigirEncontrado(
      await UsuarioRepository.findById(params.idUsuarioExecuto),
      'Usuário responsável não encontrado.'
    );

    const { ehAdmin } = UsuarioRules.autorizarEdicao(executor, params.idUsuarioAlvo);

    const usuarioAlvo = exigirEncontrado(
      await UsuarioRepository.findById(params.idUsuarioAlvo),
      'Usuário não encontrado.'
    );

    const dadosAtualizacao: {
      usuario?: string;
      hashSenha?: string;
      salt?: string;
      papel?: PapelUsuario;
    } = {};
    let rebaixaAdministrador = false;

    if (params.novoUsuario && params.novoUsuario !== usuarioAlvo.usuario) {
      UsuarioRules.exigirAdminParaAlterarNomeDeUsuario(ehAdmin);
      const existente = await UsuarioRepository.findByUsuario(params.novoUsuario);
      UsuarioRules.garantirNovoNomeDisponivel(params.novoUsuario, existente);
      dadosAtualizacao.usuario = params.novoUsuario;
    }

    if (params.novoPapel && params.novoPapel !== usuarioAlvo.papel) {
      UsuarioRules.exigirPapelValido(params.novoPapel);
      UsuarioRules.exigirAdminParaAlterarPapel(ehAdmin);
      rebaixaAdministrador = UsuarioRules.ehRebaixamentoDeAdministrador(usuarioAlvo, params.novoPapel);
      dadosAtualizacao.papel = params.novoPapel;
    }

    if (params.novaSenha && params.novaSenha.trim().length > 0) {
      UsuarioRules.exigirSenhaValida(params.novaSenha);
      const { hash, salt } = await PasswordHasher.hashPassword(params.novaSenha);
      dadosAtualizacao.hashSenha = hash;
      dadosAtualizacao.salt = salt;
    }

    UsuarioRules.exigirAlgumaAlteracao(dadosAtualizacao);

    if (!rebaixaAdministrador) {
      // Transação: NÃO. Escrita única, sem invariante dependente de leitura.
      return UsuarioRepository.update(params.idUsuarioAlvo, dadosAtualizacao);
    }

    // Transação: SIM (serializável). "contar administradores -> rebaixar" precisa ser atômico;
    // sem isso, dois administradores rebaixando um ao outro ao mesmo tempo zerariam os admins.
    return executarEmTransacao(
      async (tx) => {
        const totalAdmins = await UsuarioRepository.countAdmins(tx);
        UsuarioRules.protegerUltimoAdministrador(usuarioAlvo, totalAdmins, 'alterar o perfil do usuário');
        return UsuarioRepository.update(params.idUsuarioAlvo, dadosAtualizacao, tx);
      },
      { isolamento: 'serializavel' }
    );
  }

  // 3. Deletar usuário
  static async deletarUsuario(idUsuarioAlvo: string) {
    const usuarioAlvo = exigirEncontrado(
      await UsuarioRepository.findById(idUsuarioAlvo),
      'Usuário não encontrado.'
    );

    if (usuarioAlvo.papel !== PapelUsuario.ADMINISTRADOR) {
      // Transação: NÃO. Escrita única.
      return UsuarioRepository.delete(idUsuarioAlvo);
    }

    // Transação: SIM (serializável). Mesma invariante da edição: nunca remover o último administrador.
    return executarEmTransacao(
      async (tx) => {
        const totalAdmins = await UsuarioRepository.countAdmins(tx);
        UsuarioRules.protegerUltimoAdministrador(usuarioAlvo, totalAdmins, 'remover o usuário');
        return UsuarioRepository.delete(idUsuarioAlvo, tx);
      },
      { isolamento: 'serializavel' }
    );
  }
}
