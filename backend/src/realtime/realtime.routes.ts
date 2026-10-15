import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { authService } from '../modules/auth/auth.service.ts';
import { SESSION_COOKIE_NAME } from '../modules/auth/auth.domain.ts';
import { requireAuth } from '../middleware/auth.ts';
import type { RealtimeConnectionManager } from './connection-manager.ts';
import { RealtimeSubscriptionService } from './subscription.service.ts';

export interface RealtimeRouteDependencies {
  subscriptionService: Pick<RealtimeSubscriptionService, 'resolveAuthenticated' | 'resolvePublic'>;
  connectionManager: Pick<RealtimeConnectionManager, 'add' | 'close'>;
  validateSession?: (token: string) => Promise<unknown>;
  authenticate?: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
}

export function createRealtimeRoutes({
  subscriptionService,
  connectionManager,
  validateSession = authService.validateToken.bind(authService),
  authenticate = requireAuth,
}: RealtimeRouteDependencies): FastifyPluginAsync {
  return async (fastify) => {
    fastify.addHook('onClose', async () => connectionManager.close());

    fastify.get('/ws', { websocket: true, preValidation: authenticate }, async (socket, request) => {
      try {
        const subscription = await subscriptionService.resolveAuthenticated(request.user!, request.query);
        const token = request.cookies[SESSION_COOKIE_NAME]!;
        connectionManager.add({
          socket,
          ...subscription,
          sessionId: request.session!.id,
          isSessionActive: async () => {
            try {
              await validateSession(token);
              return true;
            } catch {
              return false;
            }
          },
        });
      } catch {
        socket.close(1008, 'Subscription rejected');
      }
    });

    fastify.get('/live/ws', { websocket: true }, async (socket, request) => {
      try {
        const subscription = await subscriptionService.resolvePublic(request.query);
        connectionManager.add({ socket, audience: 'PUBLIC', ...subscription });
      } catch {
        socket.close(1008, 'Subscription rejected');
      }
    });
  };
}
