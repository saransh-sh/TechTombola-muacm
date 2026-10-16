import type { FastifyPluginAsync } from 'fastify';
import { requireAdmin, requireSuperAdmin } from '../../middleware/auth.ts';
import { createOperationsService, type ConnectionCounter } from './operations.service.ts';
import { auditQuerySchema } from './operations.schemas.ts';

export function createOperationsRoutes(connections?: ConnectionCounter): FastifyPluginAsync {
  const service = createOperationsService(connections);
  return async (fastify) => {
    fastify.get('/admin/dashboard', { preHandler: [requireAdmin] }, async () => service.getDashboard());
    fastify.get('/admin/audit', { preHandler: [requireAdmin] }, async (request) => {
      const query = auditQuerySchema.parse(request.query);
      return service.listAudit(query);
    });
    fastify.get('/super-admin/system', { preHandler: [requireSuperAdmin] }, async () => service.getSystem());
  };
}
