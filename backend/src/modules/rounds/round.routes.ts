import type { FastifyPluginAsync } from 'fastify';
import { requireAdmin } from '../../middleware/auth.ts';
import {
  createRoundSchema,
  roundIdParamSchema,
  roundPaginationSchema,
  updateRoundSchema,
} from './round.schemas.ts';
import { roundService } from './round.service.ts';

export const roundRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', requireAdmin);

  fastify.get('/admin/rounds', async (request) => {
    const query = roundPaginationSchema.parse(request.query);
    return roundService.listRounds(query.page, query.limit, query.eventId, query.status);
  });

  fastify.get('/admin/rounds/:id', async (request) => {
    const params = roundIdParamSchema.parse(request.params);
    const round = await roundService.getRoundById(params.id);
    return { round };
  });

  fastify.post('/admin/rounds', async (request, reply) => {
    const body = createRoundSchema.parse(request.body);

    const created = await roundService.createRound(request.user!.id, body, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      requestId: request.id,
    });

    reply.status(201);
    return { round: created };
  });

  fastify.patch('/admin/rounds/:id', async (request) => {
    const params = roundIdParamSchema.parse(request.params);
    const body = updateRoundSchema.parse(request.body);

    const updated = await roundService.updateRound(
      request.user!.id,
      params.id,
      body,
      {
        ip: request.ip,
        userAgent: request.headers['user-agent'],
        requestId: request.id,
      }
    );

    return { round: updated };
  });
};
