import type { FastifyPluginAsync } from 'fastify';
import { loginSchema } from './auth.schemas.ts';
import { authService } from './auth.service.ts';
import { getSessionCookieOptions, SESSION_COOKIE_NAME, verifyAuthToken } from './auth.domain.ts';
import { requireAuth } from '../../middleware/auth.ts';

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/auth/login', async (request, reply) => {
    const body = loginSchema.parse(request.body);

    const result = await authService.login({
      email: body.email,
      password: body.password,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      requestId: request.id,
    });

    reply.setCookie(SESSION_COOKIE_NAME, result.token, getSessionCookieOptions());

    return {
      user: result.user,
    };
  });

  fastify.post('/auth/logout', async (request, reply) => {
    const token = request.cookies[SESSION_COOKIE_NAME];
    if (token) {
      try {
        const payload = verifyAuthToken(token);
        await authService.logout(payload.jti);
      } catch {
        // Ignored on logout - logout is idempotent
      }
    }

    reply.clearCookie(SESSION_COOKIE_NAME, { path: '/' });

    return {
      message: 'Successfully logged out',
    };
  });

  fastify.get('/me', { preHandler: [requireAuth] }, async (request) => {
    return {
      user: request.user,
    };
  });
};
