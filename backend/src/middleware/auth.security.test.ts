import { describe, expect, it } from 'bun:test';
import Fastify from 'fastify';
import { resetCachedEnv } from '../config/env.ts';
import { verifyMutationOrigin } from './auth.ts';

describe('security middleware error disclosure', () => {
  it('rejects an untrusted Origin without reflecting the attacker-controlled value', async () => {
    const envKeys = ['NODE_ENV', 'DATABASE_URL', 'JWT_SECRET', 'SESSION_SECRET', 'CORS_ORIGIN', 'APP_URL'] as const;
    const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:5433/security_middleware_test';
    process.env.JWT_SECRET = 'security-middleware-jwt-secret-at-least-32';
    process.env.SESSION_SECRET = 'security-middleware-session-secret-at-least-32';
    process.env.CORS_ORIGIN = 'https://trusted.example.test';
    process.env.APP_URL = 'https://trusted.example.test';
    resetCachedEnv();

    const app = Fastify();
    try {
      app.post('/mutate', async (request, reply) => {
        try {
          verifyMutationOrigin(request);
          return reply.send({ ok: true });
        } catch (error) {
          return reply.status(403).send({ message: (error as Error).message });
        }
      });

      const hostileOrigin = 'https://attacker.example.test/?token=should-not-reflect';
      const response = await app.inject({ method: 'POST', url: '/mutate', headers: { origin: hostileOrigin } });
      expect(response.statusCode).toBe(403);
      expect(response.body).not.toContain(hostileOrigin);
      expect(response.body).toContain('Invalid request origin');
    } finally {
      await app.close();
      for (const key of envKeys) {
        if (originalEnv[key] === undefined) delete process.env[key];
        else process.env[key] = originalEnv[key];
      }
      resetCachedEnv();
    }
  });
});
