import type { FastifyPluginAsync } from 'fastify';
import { requireParticipant } from '../../middleware/auth.ts';
import {
  listClaimsQuerySchema,
  submitClaimBodySchema,
} from './claim.schemas.ts';
import { claimService } from './claim.service.ts';

export const claimRoutes: FastifyPluginAsync = async (fastify) => {
  // Participant: Submit win claim
  fastify.post('/participant/claims', { preHandler: [requireParticipant] }, async (request, reply) => {
    const body = submitClaimBodySchema.parse(request.body);

    const result = await claimService.submitClaim({
      userId: request.user!.id,
      roundId: body.roundId,
      pattern: body.pattern,
    });

    reply.status(200);
    return result;
  });

  // Participant: List own claims
  fastify.get('/participant/claims', { preHandler: [requireParticipant] }, async (request) => {
    const query = listClaimsQuerySchema.parse(request.query);

    return claimService.listParticipantClaims(request.user!.id, query);
  });
};
