import Fastify from 'fastify';
import fastifyJwt from '@fastify/jwt';
import { loteRoutes } from './routes/lote.js';
import { equipamentoRoutes } from './routes/equipamento.js';
import { relatorioRoutes } from './routes/relatorio.js';
import { healthRoutes } from './routes/health.js';
import { env } from './config/env.js';
import { organizacaoRoutes } from './routes/organizacao.js';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import { authenticate } from './security/authenticate.js';
import { errorHandler } from './errors/error-handler.js';
import { usuarioRoutes } from './routes/usuario.js';
import { authRoutes } from './routes/auth.js';


export const app = Fastify({
  logger: true,
});

// Registrar o plugin JWT
app.register(fastifyJwt, {
  secret: env.JWT_SECRET,
});

// Decorador de autenticação JWT (implementação em src/security/authenticate.ts)
app.decorate('authenticate', authenticate);

await app.register(fastifySwagger, {
  openapi: {
    info: {
      title: 'Greencode API',
      description: 'API Backend para Gestão e Rastreabilidade de Resíduos Eletrônicos (E-Waste)',
      version: '1.0.0',
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
});

// Configurar Interface Gráfica UI
await app.register(fastifySwaggerUi, {
  routePrefix: '/docs',
  uiConfig: {
    docExpansion: 'list',
    deepLinking: false,
  },
});

// Registrar Rotas da API
app.register(healthRoutes, { prefix: '/api/v1' });
app.register(authRoutes, { prefix: '/api/v1/auth' });
app.register(organizacaoRoutes, { prefix: '/api/v1/organizacoes' });
app.register(loteRoutes, { prefix: '/api/v1/lotes' });
app.register(equipamentoRoutes, { prefix: '/api/v1/equipamentos' });
app.register(relatorioRoutes, { prefix: '/api/v1/relatorios' });
app.register(usuarioRoutes, { prefix: '/api/v1/usuarios' });

// Handler Global de Erros (mapeamento centralizado em src/errors)
app.setErrorHandler(errorHandler);
