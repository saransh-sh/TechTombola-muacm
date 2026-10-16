import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import websocket from '@fastify/websocket';
import multipart from '@fastify/multipart';
import { ZodError } from 'zod';
import { getEnv } from './config/env.ts';
import { REQUEST_ID_HEADER, ERROR_CODES } from './config/constants.ts';
import { normalizeRequestId } from './shared/utils/request-id.ts';
import { AppError } from './shared/errors/app-error.ts';
import { createAppRoutes } from './routes/index.ts';
import { RealtimeConnectionManager } from './realtime/connection-manager.ts';
import { RealtimeSubscriptionService } from './realtime/subscription.service.ts';
import { eventRepository } from './modules/events/event.repository.ts';
import { roundRepository } from './modules/rounds/round.repository.ts';
import { getDb } from './db/client.ts';
import { auditService } from './modules/audit/audit.service.ts';
import { drawRepository } from './modules/draws/draw.repository.ts';
import { claimRepository } from './modules/claims/claim.repository.ts';
import { WinnerRepository } from './modules/claims/winner.repository.ts';
import { ticketRepository } from './modules/tickets/ticket.repository.ts';
import { idempotencyRepository } from './shared/idempotency/idempotency.repository.ts';
import { WinnerService } from './modules/claims/winner.service.ts';
import { RecoveryService } from './modules/recovery/recovery.service.ts';
import { OperationsRepository } from './modules/operations/operations.repository.ts';
import { OperationsService } from './modules/operations/operations.service.ts';
import { LiveReadRepository } from './modules/live/live.repository.ts';
import { LiveReadService } from './modules/live/live.service.ts';

export interface BuildAppOptions {
  enableLogging?: boolean;
  winnerService?: WinnerService;
  liveReadService?: LiveReadService;
  recoveryService?: RecoveryService;
  realtimeConnectionManager?: RealtimeConnectionManager;
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const env = getEnv();

  const isLoggingEnabled =
    options.enableLogging ?? (env.NODE_ENV !== 'test' && env.LOG_LEVEL !== 'silent');

  const app = Fastify({
    logger: isLoggingEnabled
      ? {
          level: env.LOG_LEVEL,
          redact: [
            'req.headers.authorization',
            'req.headers.cookie',
            'req.headers.x-bootstrap-secret',
            '*.password',
            '*.secret',
            '*.token',
          ],
        }
      : false,
    genReqId: (req) => normalizeRequestId(req.headers[REQUEST_ID_HEADER]),
    requestIdHeader: false,
  });

  // Enable CORS
  const allowedOrigins = env.CORS_ORIGIN.split(',').map((o) => o.trim());
  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        cb(null, true);
      } else {
        cb(new AppError('CORS origin not allowed', ERROR_CODES.FORBIDDEN, 403), false);
      }
    },
    credentials: true,
  });

  // Enable Cookies
  await app.register(cookie, {
    secret: env.SESSION_SECRET,
    hook: 'onRequest',
  });
  await app.register(websocket);

  // Enable Multipart File Upload
  await app.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024,
    },
  });

  // Set Request-ID header on all responses
  app.addHook('onSend', async (request, reply) => {
    reply.header(REQUEST_ID_HEADER, request.id);
  });

  // Standard 404 handler
  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      error: {
        code: ERROR_CODES.NOT_FOUND,
        message: `Route ${request.method} ${request.url} not found`,
      },
      requestId: request.id,
    });
  });

  // Standard error handler
  app.setErrorHandler((error, request, reply) => {
    const requestId = request.id || 'unknown';

    // 1. Zod validation errors
    if (error instanceof ZodError) {
      const message = error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
      reply.status(400).send({
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: `Validation failed: ${message}`,
        },
        requestId,
      });
      return;
    }

    // 2. Fastify validation errors
    if (
      typeof error === 'object' &&
      error !== null &&
      'validation' in error &&
      Array.isArray((error as Record<string, unknown>).validation)
    ) {
      const message =
        'message' in error && typeof (error as Record<string, unknown>).message === 'string'
          ? ((error as Record<string, unknown>).message as string)
          : 'Validation failed';
      reply.status(400).send({
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message,
        },
        requestId,
      });
      return;
    }

    // 3. Known domain / application errors
    if (error instanceof AppError) {
      reply.status(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
        },
        requestId,
      });
      return;
    }

    // 4. Unexpected / database / 500 errors - strictly hide stack traces and DB details
    if (isLoggingEnabled) {
      request.log.error(error);
    }

    reply.status(500).send({
      error: {
        code: ERROR_CODES.INTERNAL_SERVER_ERROR,
        message: 'An internal server error occurred.',
      },
      requestId,
    });
  });

  // Register application routes
  const realtimeConnectionManager = options.realtimeConnectionManager ?? new RealtimeConnectionManager();
  const realtimeSubscriptionService = new RealtimeSubscriptionService(eventRepository, roundRepository);
  const winnerService = options.winnerService ?? new WinnerService({
    claimRepo: claimRepository,
    winnerRepo: new WinnerRepository(),
    ticketRepo: ticketRepository,
    drawRepo: drawRepository,
    audit: auditService,
    idempotency: idempotencyRepository,
    transactionRunner: { transaction: (callback) => getDb().transaction(callback) },
  });
  const recoveryService = options.recoveryService ?? new RecoveryService(undefined, undefined, undefined, undefined, realtimeConnectionManager);
  const operationsService = new OperationsService(new OperationsRepository(), realtimeConnectionManager);
  app.addHook('onReady', async () => {
    await recoveryService.markInterruptedRounds();
  });
  const liveReadService = options.liveReadService ?? new LiveReadService(new LiveReadRepository());
  await app.register(createAppRoutes({ realtimeConnectionManager, realtimeSubscriptionService, winnerService, liveReadService, recoveryService, operationsService }));

  return app;
}
