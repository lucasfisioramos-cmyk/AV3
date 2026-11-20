import { FastifyRequest, FastifyReply } from 'fastify';
import { UsuarioService } from '../domain/usuario/usuario.service.js';
import { sendCreated, sendList, sendSuccess } from '../http/response.js';
import type {
  AlterarMinhaSenhaRoute,
  CriarUsuarioRoute,
  EditarUsuarioRoute,
  ListarUsuariosRoute,
  RemoverUsuarioRoute,
} from '../schemas/usuario.schema.js';

export class UsuarioController {
  // Listar usuários (Apenas ADM)
  static async index(request: FastifyRequest<ListarUsuariosRoute>, reply: FastifyReply) {
    const { itens, total, page, limit } = await UsuarioService.listarUsuarios(request.query);
    return sendList(reply, itens, { total, page, limit });
  }

  // Criar novo usuário (Apenas ADM)
  static async store(request: FastifyRequest<CriarUsuarioRoute>, reply: FastifyReply) {
    const novoUsuario = await UsuarioService.criarUsuario(request.body);
    return sendCreated(reply, novoUsuario, { message: 'Usuário criado com sucesso.' });
  }

  // Editar usuário (Apenas ADM)
  static async update(request: FastifyRequest<EditarUsuarioRoute>, reply: FastifyReply) {
    const { id } = request.params;
    const { usuario, senha, papel } = request.body;

    const usuarioAtualizado = await UsuarioService.editarUsuario({
      idUsuarioAlvo: id,
      idUsuarioExecuto: request.user.sub,
      novoUsuario: usuario,
      novaSenha: senha,
      novoPapel: papel,
    });

    return sendSuccess(reply, usuarioAtualizado, { message: 'Usuário atualizado com sucesso!' });
  }

  // Alterar a própria senha (Qualquer usuário autenticado)
  static async updateMinhaSenha(request: FastifyRequest<AlterarMinhaSenhaRoute>, reply: FastifyReply) {
    const idUsuario = request.user.sub;

    await UsuarioService.alterarMinhaSenha({
      idUsuario,
      senhaAtual: request.body.senhaAtual,
      novaSenha: request.body.novaSenha,
      jti: request.user.jti,
      exp: request.user.exp,
    });

    return sendSuccess(reply, null, { message: 'Sua senha foi alterada com sucesso!' });
  }

  // Deletar usuário (Apenas ADM)
  static async delete(request: FastifyRequest<RemoverUsuarioRoute>, reply: FastifyReply) {
    await UsuarioService.deletarUsuario(request.params.id);
    return sendSuccess(reply, null, { message: 'Usuário removido com sucesso!' });
  }
}
