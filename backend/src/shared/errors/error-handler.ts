import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { AppError } from './app-error.js';
import { ERROR_CODES, HTTP_STATUS } from '../../config/constants.js';

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  requestId: string;
}

export function errorHandler(
  error: FastifyError | AppError | Error,
  request: FastifyRequest,
  reply: FastifyReply
): void {
  const requestId = (request.headers['x-request-id'] as string) || request.id || 'unknown_req';

  // 1. Domain/Application specific errors
  if (error instanceof AppError) {
    const response: ApiErrorResponse = {
      error: {
        code: error.code,
        message: error.message,
        ...(error.details !== undefined ? { details: error.details } : {}),
      },
      requestId,
    };
    reply.status(error.statusCode).send(response);
    return;
  }

  // 2. Direct Zod schema validation errors
  if (error instanceof ZodError) {
    const response: ApiErrorResponse = {
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Request validation failed',
        details: error.flatten(),
      },
      requestId,
    };
    reply.status(HTTP_STATUS.BAD_REQUEST).send(response);
    return;
  }

  // 3. Fastify internal schema validation error
  const fastifyErr = error as FastifyError;
  if (fastifyErr.validation) {
    const response: ApiErrorResponse = {
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: fastifyErr.message || 'Validation error',
        details: fastifyErr.validation,
      },
      requestId,
    };
    reply.status(HTTP_STATUS.BAD_REQUEST).send(response);
    return;
  }

  // 4. Fastify 404 / 4xx with statusCode
  if (fastifyErr.statusCode && fastifyErr.statusCode < 500) {
    const code = fastifyErr.statusCode === 404 ? ERROR_CODES.NOT_FOUND : ERROR_CODES.BAD_REQUEST;
    const response: ApiErrorResponse = {
      error: {
        code,
        message: fastifyErr.message,
      },
      requestId,
    };
    reply.status(fastifyErr.statusCode).send(response);
    return;
  }

  // 5. Unhandled / 500 Internal server errors
  request.log.error({ err: error, requestId }, 'Unhandled server exception');

  const response: ApiErrorResponse = {
    error: {
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
      message: 'An unexpected internal server error occurred.',
    },
    requestId,
  };
  reply.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send(response);
}
