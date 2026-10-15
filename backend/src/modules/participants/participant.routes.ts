import type { FastifyPluginAsync } from 'fastify';
import { requireAdmin } from '../../middleware/auth.ts';
import {
  createParticipantSchema,
  participantIdParamSchema,
  participantPaginationSchema,
  updateParticipantSchema,
} from './participant.schemas.ts';
import { participantService } from './participant.service.ts';

export const participantRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', requireAdmin);

  fastify.get('/admin/participants', async (request) => {
    const query = participantPaginationSchema.parse(request.query);
    return participantService.listParticipants({
      eventId: query.eventId,
      page: query.page,
      limit: query.limit,
      search: query.search,
      status: query.status,
    });
  });

  fastify.get('/admin/participants/:id', async (request) => {
    const params = participantIdParamSchema.parse(request.params);
    const participant = await participantService.getParticipantById(params.id);
    return { participant };
  });

  fastify.post('/admin/participants', async (request, reply) => {
    const body = createParticipantSchema.parse(request.body);

    const created = await participantService.createParticipant(request.user!.id, body, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      requestId: request.id,
    });

    reply.status(201);
    return { participant: created };
  });

  fastify.patch('/admin/participants/:id', async (request) => {
    const params = participantIdParamSchema.parse(request.params);
    const body = updateParticipantSchema.parse(request.body);

    const updated = await participantService.updateParticipant(
      request.user!.id,
      params.id,
      body,
      {
        ip: request.ip,
        userAgent: request.headers['user-agent'],
        requestId: request.id,
      }
    );

    return { participant: updated };
  });
};
