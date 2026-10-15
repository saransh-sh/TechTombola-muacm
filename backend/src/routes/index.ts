import type { FastifyPluginAsync } from 'fastify';
import { healthRoutes } from './health.routes.ts';
import { API_PREFIX } from '../config/constants.ts';

export const appRoutes: FastifyPluginAsync = async (fastify) => {
  // Root level health endpoints per PRD §63
  await fastify.register(healthRoutes);

  // API v1 namespace for future domain routes
  await fastify.register(
    async (v1) => {
      v1.get('/ping', async () => ({ message: 'pong' }));
    },
    { prefix: API_PREFIX }
  );
};
