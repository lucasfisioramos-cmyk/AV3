import { FastifyInstance } from 'fastify';
import { AuthController } from '../controllers/auth.controller.js';
import { authenticate } from '../security/authenticate.js';
import { errors } from '../schemas/common.schema.js';
import {
  loginBodySchema,
  loginResponseSchema,
  logoutResponseSchema,
  type LoginRoute,
} from '../schemas/auth.schema.js';
import { env } from '../config/env.js';

export interface AuthRoutesOptions {
  rateLimit?: {
    max?: number;
    timeWindow?: string | number;
  };
}

export async function authRoutes(app: FastifyInstance, options?: AuthRoutesOptions) {
  const max = options?.rateLimit?.max ?? env.RATE_LIMIT_LOGIN_MAX;
  const timeWindow = options?.rateLimit?.timeWindow ?? env.RATE_LIMIT_LOGIN_TIME_WINDOW;

  app.post<LoginRoute>(
    '/login',
    {
      config: {
        rateLimit: {
          max,
          timeWindow,
        },
      },
      schema: {
        tags: ['Autenticação'],
        summary: 'Autentica o usuário e retorna um token JWT',
        security: [],
        body: loginBodySchema,
        response: { 200: loginResponseSchema, ...errors(400, 401, 429) },
      },
    },
    AuthController.login
  );

  app.post(
    '/logout',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Autenticação'],
        summary: 'Revoga o token JWT da sessão atual (logout)',
        security: [{ bearerAuth: [] }],
        response: { 200: logoutResponseSchema, ...errors(401) },
      },
    },
    AuthController.logout
  );
}
