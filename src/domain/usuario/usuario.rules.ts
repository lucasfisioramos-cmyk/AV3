import { PapelUsuario } from '@prisma/client';
import { ConflictError, ForbiddenError, RegraDeNegocioError } from '../../errors/app-error.js';
import { exigirValido } from '../shared/guards.js';
import { validarPapel, validarSenha } from '../validators/index.js';

/** Regras de negócio de usuário. Funções puras: recebem os dados já carregados. */
export const UsuarioRules = {
  exigirPapelValido(papel: unknown): void {
    exigirValido(validarPapel(papel));
  },

  exigirSenhaValida(senha: string): void {
    exigirValido(validarSenha(senha));
  },

  garantirUsuarioInedito(usuario: string, existente: unknown): void {
    if (existente) throw new ConflictError(`O usuário "${usuario}" já está cadastrado.`);
  },

  garantirNovoNomeDisponivel(novoUsuario: string, existente: unknown): void {
    if (existente) throw new ConflictError(`O nome de usuário "${novoUsuario}" já está em uso.`);
  },

  /** Administradores editam qualquer usuário; os demais, apenas a si mesmos. */
  autorizarEdicao(
    executor: { id: string; papel: PapelUsuario },
    idUsuarioAlvo: string
  ): { ehAdmin: boolean; ehProprioUsuario: boolean } {
    const ehAdmin = executor.papel === PapelUsuario.ADMINISTRADOR;
    const ehProprioUsuario = idUsuarioAlvo === executor.id;

    if (!ehAdmin && !ehProprioUsuario) {
      throw new ForbiddenError('Acesso negado: Apenas administradores podem editar outros usuários.');
    }
    return { ehAdmin, ehProprioUsuario };
  },

  exigirAdminParaAlterarNomeDeUsuario(ehAdmin: boolean): void {
    if (!ehAdmin) {
      throw new ForbiddenError('Acesso negado: Apenas administradores podem alterar o nome de usuário.');
    }
  },

  exigirAdminParaAlterarPapel(ehAdmin: boolean): void {
    if (!ehAdmin) {
      throw new ForbiddenError('Acesso negado: Apenas administradores podem alterar o perfil de acesso.');
    }
  },

  /** Verdadeiro quando a mudança tira o papel de administrador de quem hoje o possui. */
  ehRebaixamentoDeAdministrador(alvo: { papel: PapelUsuario }, novoPapel: PapelUsuario): boolean {
    return alvo.papel === PapelUsuario.ADMINISTRADOR && novoPapel !== PapelUsuario.ADMINISTRADOR;
  },

  /** O sistema nunca pode ficar sem administradores. */
  protegerUltimoAdministrador(
    alvo: { usuario: string },
    totalAdministradores: number,
    acao: 'alterar o perfil do usuário' | 'remover o usuário'
  ): void {
    if (totalAdministradores <= 1) {
      throw new RegraDeNegocioError(
        `Não é possível ${acao} "${alvo.usuario}", pois ele é o único administrador do sistema.`
      );
    }
  },

  exigirAlgumaAlteracao(dados: object): void {
    if (Object.keys(dados).length === 0) {
      throw new RegraDeNegocioError('Nenhum dado válido foi fornecido para atualização.');
    }
  },
};
