import { describe, it, expect, beforeEach } from 'bun:test';
import { z } from 'zod';
import type { FastifyError } from 'fastify';
import { createApp } from '../../../src/app.js';
import {
  BadRequestError,
  NotFoundError,
  ConflictError,
  UnauthorizedError,
  ForbiddenError,
  UnprocessableError,
  RateLimitError,
  InternalServerError,
} from '../../../src/shared/errors/app-error.js';
import { loadEnv } from '../../../src/config/env.js';

describe('Shared Errors — errorHandler and AppError', () => {
  beforeEach(() => {
    loadEnv({
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/tech_tombola',
      JWT_SECRET: 'test_jwt_secret_min_32_characters_long_for_testing',
      SESSION_SECRET: 'test_session_secret_min_32_characters_long_for_testing',
      NODE_ENV: 'test',
    });
  });

  it('formats custom AppError with matching status code and code string', async () => {
    const app = createApp();
    app.get('/test-not-found', async () => {
      throw new NotFoundError('Ticket card does not exist');
    });

    const response = await app.inject({
      method: 'GET',
      url: '/test-not-found',
    });

    expect(response.statusCode).toBe(404);
    const body = response.json();
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.message).toBe('Ticket card does not exist');
    expect(typeof body.requestId).toBe('string');
  });

  it('formats BadRequestError and InternalServerError', async () => {
    const app = createApp();
    app.get('/test-bad-req', async () => {
      throw new BadRequestError('Invalid query params');
    });
    app.get('/test-internal-app-err', async () => {
      throw new InternalServerError('Custom internal error');
    });

    const resBad = await app.inject({ method: 'GET', url: '/test-bad-req' });
    expect(resBad.statusCode).toBe(400);
    expect(resBad.json().error.code).toBe('BAD_REQUEST');

    const resInternal = await app.inject({ method: 'GET', url: '/test-internal-app-err' });
    expect(resInternal.statusCode).toBe(500);
    expect(resInternal.json().error.code).toBe('INTERNAL_SERVER_ERROR');
  });

  it('formats ConflictError with 409 status code', async () => {
    const app = createApp();
    app.get('/test-conflict', async () => {
      throw new ConflictError('Pattern already won');
    });

    const response = await app.inject({
      method: 'GET',
      url: '/test-conflict',
    });

    expect(response.statusCode).toBe(409);
    const body = response.json();
    expect(body.error.code).toBe('CONFLICT');
    expect(body.error.message).toBe('Pattern already won');
  });

  it('formats UnprocessableError with 422 status code', async () => {
    const app = createApp();
    app.get('/test-unprocessable', async () => {
      throw new UnprocessableError('Cannot mark undrawn key');
    });

    const response = await app.inject({
      method: 'GET',
      url: '/test-unprocessable',
    });

    expect(response.statusCode).toBe(422);
    const body = response.json();
    expect(body.error.code).toBe('UNPROCESSABLE_ENTITY');
    expect(body.error.message).toBe('Cannot mark undrawn key');
  });

  it('formats UnauthorizedError (401) and ForbiddenError (403)', async () => {
    const app = createApp();
    app.get('/test-401', async () => {
      throw new UnauthorizedError('Token expired');
    });
    app.get('/test-403', async () => {
      throw new ForbiddenError('Admin role required');
    });

    const res401 = await app.inject({ method: 'GET', url: '/test-401' });
    expect(res401.statusCode).toBe(401);
    expect(res401.json().error.code).toBe('UNAUTHORIZED');

    const res403 = await app.inject({ method: 'GET', url: '/test-403' });
    expect(res403.statusCode).toBe(403);
    expect(res403.json().error.code).toBe('FORBIDDEN');
  });

  it('formats RateLimitError with 429 status code', async () => {
    const app = createApp();
    app.get('/test-rate-limit', async () => {
      throw new RateLimitError('Too many login attempts');
    });

    const response = await app.inject({
      method: 'GET',
      url: '/test-rate-limit',
    });

    expect(response.statusCode).toBe(429);
    expect(response.json().error.code).toBe('RATE_LIMITED');
  });

  it('formats Zod validation errors with 400 and VALIDATION_ERROR code', async () => {
    const app = createApp();
    const testSchema = z.object({
      email: z.string().email(),
    });

    app.post('/test-zod', async (request) => {
      testSchema.parse(request.body);
      return { ok: true };
    });

    const response = await app.inject({
      method: 'POST',
      url: '/test-zod',
      payload: { email: 'not-an-email' },
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details).toBeDefined();
  });

  it('formats Fastify schema validation error object', async () => {
    const app = createApp();
    app.get('/test-fastify-val', async () => {
      const err = new Error('Invalid format') as FastifyError;
      err.validation = [{ keyword: 'type', instancePath: '/id', schemaPath: '', params: {}, message: 'must be string' }];
      throw err;
    });

    const response = await app.inject({
      method: 'GET',
      url: '/test-fastify-val',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('formats Fastify 4xx error with statusCode', async () => {
    const app = createApp();
    app.get('/test-fastify-400', async () => {
      const err = new Error('Malformed URL header') as FastifyError;
      err.statusCode = 400;
      throw err;
    });

    const response = await app.inject({
      method: 'GET',
      url: '/test-fastify-400',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('BAD_REQUEST');
  });

  it('formats 404 Route Not Found in standard API error format', async () => {
    const app = createApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/non-existent-endpoint',
    });

    expect(response.statusCode).toBe(404);
    const body = response.json();
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.message).toContain('Route GET /api/v1/non-existent-endpoint not found');
    expect(typeof body.requestId).toBe('string');
  });

  it('masks unexpected exceptions into 500 without leaking stack traces', async () => {
    const app = createApp();
    app.get('/test-crash', async () => {
      throw new Error('Fatal database connection string leak or unexpected bug');
    });

    const response = await app.inject({
      method: 'GET',
      url: '/test-crash',
    });

    expect(response.statusCode).toBe(500);
    const body = response.json();
    expect(body.error.code).toBe('INTERNAL_SERVER_ERROR');
    expect(body.error.message).toBe('An unexpected internal server error occurred.');
    expect(body.error.details).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain('Fatal database connection string');
  });

  it('honors and propagates incoming x-request-id header', async () => {
    const customId = 'client-trace-id-12345';
    const app = createApp();
    app.get('/test-id', async () => {
      throw new BadRequestError('Invalid input');
    });

    const response = await app.inject({
      method: 'GET',
      url: '/test-id',
      headers: {
        'x-request-id': customId,
      },
    });

    expect(response.headers['x-request-id']).toBe(customId);
    expect(response.json().requestId).toBe(customId);
  });
});
