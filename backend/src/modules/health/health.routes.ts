import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { healthService, HealthService } from './health.service.js';
import { HTTP_STATUS } from '../../config/constants.js';

export interface HealthRoutesOptions {
  service?: HealthService;
}

export const healthRoutes: FastifyPluginAsync<HealthRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: HealthRoutesOptions
) => {
  const service = opts.service || healthService;

  fastify.get('/health', async (_request, reply) => {
    const result = service.getLiveness();
    return reply.status(HTTP_STATUS.OK).send(result);
  });

  fastify.get('/ready', async (_request, reply) => {
    const result = await service.getReadiness();
    if (!result.isReady) {
      return reply.status(HTTP_STATUS.SERVICE_UNAVAILABLE).send({
        status: result.status,
        database: result.database,
      });
    }
    return reply.status(HTTP_STATUS.OK).send({
      status: result.status,
      database: result.database,
    });
  });
};
