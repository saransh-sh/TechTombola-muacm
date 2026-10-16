import type { FastifyPluginAsync } from 'fastify';
import { healthRoutes } from './health.routes.ts';
import { API_PREFIX } from '../config/constants.ts';
import { createAuthRoutes } from '../modules/auth/auth.routes.ts';
import { adminRoutes } from '../modules/admins/admin.routes.ts';
import { eventRoutes } from '../modules/events/event.routes.ts';
import { roundRoutes } from '../modules/rounds/round.routes.ts';
import { roundService } from '../modules/rounds/round.service.ts';
import { createRealtimeRoutes } from '../realtime/realtime.routes.ts';
import type { RealtimeConnectionManager } from '../realtime/connection-manager.ts';
import type { RealtimeSubscriptionService } from '../realtime/subscription.service.ts';
import { questionRoutes } from '../modules/questions/question.routes.ts';
import { participantRoutes } from '../modules/participants/participant.routes.ts';
import { ticketRoutes } from '../modules/tickets/ticket.routes.ts';

export interface AppRouteDependencies {
  realtimeConnectionManager: RealtimeConnectionManager;
  realtimeSubscriptionService: RealtimeSubscriptionService;
}

export function createAppRoutes({
  realtimeConnectionManager,
  realtimeSubscriptionService,
}: AppRouteDependencies): FastifyPluginAsync {
  roundService.setRealtimePublisher(realtimeConnectionManager);

  return async (fastify) => {
    await fastify.register(healthRoutes);
    await fastify.register(
      async (v1) => {
        v1.get('/ping', async () => ({ message: 'pong' }));
        await v1.register(createAuthRoutes({ onSessionRevoked: (sessionId) => realtimeConnectionManager.closeSession(sessionId) }));
        await v1.register(adminRoutes);
        await v1.register(eventRoutes);
        await v1.register(roundRoutes);
        await v1.register(
          createRealtimeRoutes({
            connectionManager: realtimeConnectionManager,
            subscriptionService: realtimeSubscriptionService,
          })
        );
        await v1.register(questionRoutes);
        await v1.register(participantRoutes);
        await v1.register(ticketRoutes);
      },
      { prefix: API_PREFIX }
    );
  };
}
