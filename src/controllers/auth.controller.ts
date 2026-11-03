import { FastifyRequest, FastifyReply } from 'fastify';
import { AuthService } from '../domain/auth/auth.service.js';
import { sendSuccess } from '../http/response.js';
import type { LoginRoute } from '../schemas/auth.schema.js';
import type { JwtClaims } from '../types/auth.js';

export class AuthController {
  static async login(request: FastifyRequest<LoginRoute>, reply: FastifyReply) {
    const { usuario, senha } = request.body;

    const credencial = await AuthService.autenticar(usuario, senha);

    // Gerar token JWT Stateless via Fastify
    const token = request.server.jwt.sign(
      {
        sub: credencial.id,
        usuario: credencial.usuario,
        papel: credencial.papel,
      } satisfies JwtClaims,
      { expiresIn: '8h' }
    );

    return sendSuccess(
      reply,
      { token, usuario: credencial.usuario, papel: credencial.papel },
      { message: 'Login realizado com sucesso.' }
    );
  }
}
