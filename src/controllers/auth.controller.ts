import { randomUUID } from 'node:crypto';
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
        jti: randomUUID(),
      } satisfies JwtClaims
      // iss, aud, exp e algoritmo vêm da configuração central (src/security/jwt.ts)
    );

    return sendSuccess(
      reply,
      { token, usuario: credencial.usuario, papel: credencial.papel },
      { message: 'Login realizado com sucesso.' }
    );
  }

  static async logout(request: FastifyRequest, reply: FastifyReply) {
    const { jti, exp } = request.user;
    const expiresAt = new Date(exp * 1000);

    await AuthService.revogarToken({ jti, expiresAt, motivo: 'LOGOUT' });

    return sendSuccess(reply, null, { message: 'Logout realizado com sucesso.' });
  }
}
