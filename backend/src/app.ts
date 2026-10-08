import fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import cors from '@fastify/cors';
import { randomUUID } from 'node:crypto';
import { errorHandler } from './shared/errors/error-handler.js';
import { healthRoutes, type HealthRoutesOptions } from './modules/health/health.routes.js';
import { API_PREFIX, ERROR_CODES, HTTP_STATUS } from './config/constants.js';
import { getEnv } from './config/env.js';

export interface AppOptions extends FastifyServerOptions {
  healthOptions?: HealthRoutesOptions;
}

export function createApp(opts: AppOptions = {}): FastifyInstance {
  const env = getEnv();

  const app = fastify({
    logger: env.NODE_ENV === 'test' ? false : { level: env.LOG_LEVEL },
    genReqId: (req) => (req.headers['x-request-id'] as string) || randomUUID(),
    ...opts,
  });

  // 1. CORS
  app.register(cors, {
    origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // 2. Set X-Request-Id header on all responses
  app.addHook('onSend', async (request, reply) => {
    reply.header('x-request-id', request.id);
  });

  // 3. Central Error Handler
  app.setErrorHandler(errorHandler);

  // 4. Custom 404 Not Found Handler adhering to API error contract
  app.setNotFoundHandler((request, reply) => {
    reply.status(HTTP_STATUS.NOT_FOUND).send({
      error: {
        code: ERROR_CODES.NOT_FOUND,
        message: `Route ${request.method} ${request.url} not found`,
      },
      requestId: request.id,
    });
  });

  // 5. Diagnostics & Probes (mounted at root)
  app.register(healthRoutes, opts.healthOptions || {});

  // 6. API v1 Base Route Namespace (for future feature modules)
  app.register(
    async (v1) => {
      v1.get('/', async () => ({
        service: 'Tech Tombola API',
        version: 'v1',
        status: 'active',
      }));
    },
    { prefix: API_PREFIX }
  );

  return app;
}
