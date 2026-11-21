import { readFileSync } from 'node:fs';
import Fastify, { type FastifyInstance } from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import fastifyRateLimit from '@fastify/rate-limit';
import { loggerOptions } from './config/logger.js';
import { jwtOptions } from './security/jwt.js';
import { env } from './config/env.js';
import { loteRoutes } from './routes/lote.js';
import { equipamentoRoutes } from './routes/equipamento.js';
import { relatorioRoutes } from './routes/relatorio.js';
import { healthRoutes } from './routes/health.js';
import { organizacaoRoutes } from './routes/organizacao.js';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import { jsonSchemaTransform, serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import './config/zod.js';
import { desconectarBanco } from './persistence/prisma.js';
import { authenticate } from './security/authenticate.js';
import { errorHandler } from './errors/error-handler.js';
import { usuarioRoutes } from './routes/usuario.js';
import { authRoutes } from './routes/auth.js';
import { AuthService } from './domain/auth/auth.service.js';
import { apiKeyRoutes } from './api/routes/internal/api-key.routes.js';
import { publicRoutes } from './api/routes/public/public.routes.js';

const packageJson = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf-8')
) as { version: string };

export interface BuildAppOptions {
  cors?: {
    origins?: string[];
  };
  rateLimit?: {
    globalMax?: number;
    globalTimeWindow?: string | number;
    loginMax?: number;
    loginTimeWindow?: string | number;
  };
}

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const instance = Fastify({
    logger: loggerOptions,
  });

  // Validação de entrada e serialização de saída via schemas Zod
  instance.setValidatorCompiler(validatorCompiler);
  instance.setSerializerCompiler(serializerCompiler);

  // Configuração de CORS dinâmico por ambiente (S4)
  const corsOrigins = options.cors?.origins ?? env.CORS_ORIGINS;
  const allowAllOrigins = corsOrigins.includes('*');

  instance.register(fastifyCors, {
    origin: (origin, cb) => {
      if (!origin || allowAllOrigins || corsOrigins.includes(origin)) {
        cb(null, true);
      } else {
        cb(null, false);
      }
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-api-key', 'X-API-Key'],
    credentials: true,
  });

  // Rotina automatizada de limpeza de tokens expirados (executa a cada 1 hora)
  const intervalLimpeza = setInterval(() => {
    AuthService.limparTokensExpirados().catch((err) => {
      instance.log.error({ err }, 'Erro ao limpar tokens expirados');
    });
  }, 1000 * 60 * 60);
  intervalLimpeza.unref();

  // Libera as conexões do banco e finaliza rotinas ao encerrar o servidor
  instance.addHook('onClose', async () => {
    clearInterval(intervalLimpeza);
    try {
      await desconectarBanco();
    } catch (err) {
      instance.log.error({ err }, 'Falha ao desconectar do banco de dados');
    }
  });

  // Rate Limiting global (mitigação de brute-force e abuso)
  instance.register(fastifyRateLimit, {
    global: true,
    max: options.rateLimit?.globalMax ?? env.RATE_LIMIT_GLOBAL_MAX,
    timeWindow: options.rateLimit?.globalTimeWindow ?? env.RATE_LIMIT_GLOBAL_TIME_WINDOW,
    errorResponseBuilder: (_req, context) => ({
      statusCode: 429,
      error: 'Too Many Requests',
      message: `Taxa limite de requisições excedida. Tente novamente em ${context.after}.`,
    }),
  });

  // Registrar o plugin JWT
  instance.register(fastifyJwt, jwtOptions);

  // Decorador de autenticação JWT (implementação em src/security/authenticate.ts)
  instance.decorate('authenticate', authenticate);

  instance.register(fastifySwagger, {
    transform: jsonSchemaTransform,
    openapi: {
      info: {
        title: 'Greencode API',
        description: 'API Backend para Gestão e Rastreabilidade de Resíduos Eletrônicos (E-Waste)',
        version: packageJson.version,
      },
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
          apiKeyAuth: {
            type: 'apiKey',
            in: 'header',
            name: 'x-api-key',
          },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  });

  // Configurar Interface Gráfica UI
  instance.register(fastifySwaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
  });

  // Registrar Rotas da API
  instance.register(healthRoutes, { prefix: '/api/v1' });
  instance.register(authRoutes, {
    prefix: '/api/v1/auth',
    rateLimit: {
      max: options.rateLimit?.loginMax ?? env.RATE_LIMIT_LOGIN_MAX,
      timeWindow: options.rateLimit?.loginTimeWindow ?? env.RATE_LIMIT_LOGIN_TIME_WINDOW,
    },
  });
  instance.register(organizacaoRoutes, { prefix: '/api/v1/organizacoes' });
  instance.register(loteRoutes, { prefix: '/api/v1/lotes' });
  instance.register(equipamentoRoutes, { prefix: '/api/v1/equipamentos' });
  instance.register(relatorioRoutes, { prefix: '/api/v1/relatorios' });
  instance.register(usuarioRoutes, { prefix: '/api/v1/usuarios' });

  // Segregação AV3: Rotas Internas (/api/v1/internal/*) e Rotas Públicas B2B (/api/v1/public/*)
  instance.register(apiKeyRoutes, { prefix: '/api/v1/internal/api-keys' });
  instance.register(authRoutes, {
    prefix: '/api/v1/internal/auth',
    rateLimit: {
      max: options.rateLimit?.loginMax ?? env.RATE_LIMIT_LOGIN_MAX,
      timeWindow: options.rateLimit?.loginTimeWindow ?? env.RATE_LIMIT_LOGIN_TIME_WINDOW,
    },
  });
  instance.register(organizacaoRoutes, { prefix: '/api/v1/internal/organizacoes' });
  instance.register(loteRoutes, { prefix: '/api/v1/internal/lotes' });
  instance.register(equipamentoRoutes, { prefix: '/api/v1/internal/equipamentos' });
  instance.register(relatorioRoutes, { prefix: '/api/v1/internal/relatorios' });
  instance.register(usuarioRoutes, { prefix: '/api/v1/internal/usuarios' });

  instance.register(publicRoutes, { prefix: '/api/v1/public' });

  // Handler Global de Erros (mapeamento centralizado em src/errors)
  instance.setErrorHandler(errorHandler);

  return instance;
}

// Monta a aplicação padrão SEM `listen`: server.ts sobe o servidor e os testes usam `app.inject`.
export const app = buildApp();
