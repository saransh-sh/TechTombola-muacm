import type { FastifyPluginAsync } from 'fastify';
import { healthRoutes } from './health.routes.ts';
import { API_PREFIX } from '../config/constants.ts';

import { authRoutes } from '../modules/auth/auth.routes.ts';
import { adminRoutes } from '../modules/admins/admin.routes.ts';
import { eventRoutes } from '../modules/events/event.routes.ts';
import { roundRoutes } from '../modules/rounds/round.routes.ts';
import { questionRoutes } from '../modules/questions/question.routes.ts';

export const appRoutes: FastifyPluginAsync = async (fastify) => {
  // Root level health endpoints per PRD §63
  await fastify.register(healthRoutes);

  // API v1 namespace
  await fastify.register(
    async (v1) => {
      v1.get('/ping', async () => ({ message: 'pong' }));
      await v1.register(authRoutes);
      await v1.register(adminRoutes);
      await v1.register(eventRoutes);
      await v1.register(roundRoutes);
      await v1.register(questionRoutes);
    },
    { prefix: API_PREFIX }
  );
};
