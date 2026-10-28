import { FastifyInstance } from 'fastify';
import { UsuarioController } from '../controllers/usuario.controller.js';
import { authorize, GRUPOS_DE_ACESSO } from '../security/roles.js';
import { errors, idParamsSchema } from '../schemas/common.schema.js';
import {
  alterarMinhaSenhaBodySchema,
  criarUsuarioBodySchema,
  editarUsuarioBodySchema,
  semConteudoResponseSchema,
  usuarioAtualizadoResponseSchema,
  usuarioCriadoResponseSchema,
  type AlterarMinhaSenhaRoute,
  type CriarUsuarioRoute,
  type EditarUsuarioRoute,
  type RemoverUsuarioRoute,
} from '../schemas/usuario.schema.js';

export async function usuarioRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  const apenasAdministradores = authorize(GRUPOS_DE_ACESSO.ADMINISTRADORES);

  // Rota para qualquer usuário autenticado trocar sua própria senha
  app.patch<AlterarMinhaSenhaRoute>(
    '/me/senha',
    {
      schema: {
        tags: ['Usuários'],
        summary: 'Altera a senha do usuário autenticado',
        body: alterarMinhaSenhaBodySchema,
        response: { 200: semConteudoResponseSchema, ...errors(400, 401, 404) },
      },
    },
    UsuarioController.updateMinhaSenha
  );

  // 🔒 Rotas exclusivas do ADMINISTRADOR
  app.post<CriarUsuarioRoute>(
    '/',
    {
      onRequest: apenasAdministradores,
      schema: {
        tags: ['Usuários'],
        summary: 'Cria um usuário (somente administrador)',
        body: criarUsuarioBodySchema,
        response: { 201: usuarioCriadoResponseSchema, ...errors(400, 401, 403, 409) },
      },
    },
    UsuarioController.store
  );

  app.put<EditarUsuarioRoute>(
    '/:id',
    {
      onRequest: apenasAdministradores,
      schema: {
        tags: ['Usuários'],
        summary: 'Edita um usuário (somente administrador)',
        params: idParamsSchema,
        body: editarUsuarioBodySchema,
        response: { 200: usuarioAtualizadoResponseSchema, ...errors(400, 401, 403, 404, 409) },
      },
    },
    UsuarioController.update
  );

  app.delete<RemoverUsuarioRoute>(
    '/:id',
    {
      onRequest: apenasAdministradores,
      schema: {
        tags: ['Usuários'],
        summary: 'Remove um usuário (somente administrador)',
        params: idParamsSchema,
        response: { 200: semConteudoResponseSchema, ...errors(400, 401, 403, 404) },
      },
    },
    UsuarioController.delete
  );
}
