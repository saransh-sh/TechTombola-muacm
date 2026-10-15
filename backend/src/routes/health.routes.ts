import type { FastifyPluginAsync } from 'fastify';
import { checkDbHealth } from '../db/client.ts';
import { ServiceUnavailableError } from '../shared/errors/app-error.ts';

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/health', async () => {
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  });

  fastify.get('/ready', async () => {
    const dbStatus = await checkDbHealth(2000);

    if (!dbStatus.ok) {
      throw new ServiceUnavailableError('Database is unavailable');
    }

    return {
      status: 'ready',
      checks: {
        database: 'ok',
        config: 'ok',
      },
      latencyMs: dbStatus.latencyMs,
      timestamp: new Date().toISOString(),
    };
  });
};
