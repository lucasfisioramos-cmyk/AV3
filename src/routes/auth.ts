import { FastifyInstance } from 'fastify';
import { AuthController } from '../controllers/auth.controller.js';
import { errors } from '../schemas/common.schema.js';
import { loginBodySchema, loginResponseSchema, type LoginRoute } from '../schemas/auth.schema.js';

export async function authRoutes(app: FastifyInstance) {
  app.post<LoginRoute>(
    '/login',
    {
      schema: {
        tags: ['Autenticação'],
        summary: 'Autentica o usuário e retorna um token JWT',
        security: [],
        body: loginBodySchema,
        response: { 200: loginResponseSchema, ...errors(400, 401) },
      },
    },
    AuthController.login
  );
}
