import { FastifyRequest, FastifyReply } from 'fastify';
import { UsuarioService } from '../domain/usuario/usuario.service.js';
import { sendCreated, sendSuccess } from '../http/response.js';
import type {
  AlterarMinhaSenhaRoute,
  CriarUsuarioRoute,
  EditarUsuarioRoute,
  RemoverUsuarioRoute,
} from '../schemas/usuario.schema.js';

export class UsuarioController {
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

    await UsuarioService.editarUsuario({
      idUsuarioAlvo: idUsuario,
      idUsuarioExecuto: idUsuario,
      novaSenha: request.body.novaSenha,
    });

    return sendSuccess(reply, null, { message: 'Sua senha foi alterada com sucesso!' });
  }

  // Deletar usuário (Apenas ADM)
  static async delete(request: FastifyRequest<RemoverUsuarioRoute>, reply: FastifyReply) {
    await UsuarioService.deletarUsuario(request.params.id);
    return sendSuccess(reply, null, { message: 'Usuário removido com sucesso!' });
  }
}
