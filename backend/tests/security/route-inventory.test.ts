import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { buildApp } from '../../src/app.ts';
import { resetCachedEnv } from '../../src/config/env.ts';
import { RecoveryService } from '../../src/modules/recovery/recovery.service.ts';
import { authService } from '../../src/modules/auth/auth.service.ts';
import { WEBSOCKET_MAX_PAYLOAD_BYTES } from '../../src/config/constants.ts';
import { concreteProbePath, PROTECTED_ROUTES, ROUTE_INVENTORY } from './route-inventory.ts';

class NoStartupRecovery extends RecoveryService {
  override async markInterruptedRounds(): Promise<string[]> {
    return [];
  }
}

describe('runtime security route inventory', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  const originalValidateToken = authService.validateToken.bind(authService);
  const envKeys = ['NODE_ENV', 'DATABASE_URL', 'JWT_SECRET', 'SESSION_SECRET', 'CORS_ORIGIN'] as const;
  const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:5433/security_route_inventory';
    process.env.JWT_SECRET = 'security-route-inventory-jwt-secret-at-least-32';
    process.env.SESSION_SECRET = 'security-route-inventory-session-secret-at-least-32';
    process.env.CORS_ORIGIN = 'http://localhost:5173';
    resetCachedEnv();
    authService.validateToken = async (token) => {
      const role = token.replace('security-', '');
      if (!['PARTICIPANT', 'ADMIN', 'SUPER_ADMIN'].includes(role)) throw new Error('Unknown security fixture session');
      const userId = '11111111-1111-4111-8111-111111111111';
      return {
        user: { id: userId, email: 'matrix@example.test', name: 'Matrix User', role, status: 'ACTIVE', eventId: '22222222-2222-4222-8222-222222222222' },
        session: {
          id: `session-${role}`,
          userId,
          tokenHash: null,
          ip: null,
          userAgent: null,
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 60_000),
          revokedAt: null,
        },
      };
    };
    app = await buildApp({ enableLogging: false, recoveryService: new NoStartupRecovery() });
    await app.ready();
  });

  afterAll(async () => {
    await app?.close();
    authService.validateToken = originalValidateToken;
    for (const key of envKeys) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
    resetCachedEnv();
  });

  it('has one explicit security policy for every registered public, protected, and WebSocket route', () => {
    const keys = ROUTE_INVENTORY.map(({ method, path }) => `${method} ${path}`);
    expect(new Set(keys).size).toBe(keys.length);

    for (const route of ROUTE_INVENTORY) {
      expect(app.hasRoute({ method: route.method, url: route.path })).toBe(true);
    }

    for (const method of ['GET', 'POST', 'PATCH', 'DELETE'] as const) {
      const actualCount = (app.printRoutes({ method }).match(new RegExp(`\\(${method}\\)`, 'g')) ?? []).length;
      const expectedCount = ROUTE_INVENTORY.filter((route) => route.method === method).length;
      expect(actualCount, `unlisted ${method} route in Fastify's runtime tree:\n${app.printRoutes({ method })}`).toBe(expectedCount);
    }
  });

  it('records an explicit reason for every protected operation without an ownership boundary', () => {
    for (const route of PROTECTED_ROUTES.filter((entry) => entry.scope === 'GLOBAL')) {
      expect(route.scopeReason?.trim(), `${route.method} ${route.path} must explain its global scope`).toBeTruthy();
    }
  });

  it('rejects unauthenticated requests for every protected HTTP route generated from the inventory', async () => {
    for (const route of PROTECTED_ROUTES) {
      const response = await app.inject({
        method: route.method,
        url: concreteProbePath(route.path),
      });
      expect(
        response.statusCode,
        `unauthenticated ${route.method} ${route.path} must be denied before its handler runs; got ${response.statusCode}`
      ).toBe(401);
    }
  });

  it('rejects a valid but wrong-role session for every role-restricted route generated from the inventory', async () => {
    for (const route of PROTECTED_ROUTES.filter((entry) => ['PARTICIPANT', 'ADMIN', 'SUPER_ADMIN'].includes(entry.role))) {
      const wrongRole = route.role === 'PARTICIPANT' ? 'ADMIN' : route.role === 'SUPER_ADMIN' ? 'ADMIN' : 'PARTICIPANT';
      const response = await app.inject({
        method: route.method,
        url: concreteProbePath(route.path),
        headers: { cookie: `session_token=security-${wrongRole}` },
      });
      expect(
        response.statusCode,
        `wrong-role ${wrongRole} ${route.method} ${route.path} must be denied before its handler runs; got ${response.statusCode}`
      ).toBe(403);
    }
  });

  it('requires scope rationale for identity-bound and Participant Event-bound routes', () => {
    for (const route of PROTECTED_ROUTES.filter((entry) => entry.scope === 'IDENTITY' || entry.scope === 'PARTICIPANT_EVENT')) {
      expect(route.scopeReason?.trim(), `${route.method} ${route.path} must document its ownership boundary`).toBeTruthy();
    }
  });

  it('configures an explicit WebSocket inbound frame limit', () => {
    expect(app.websocketServer.options.maxPayload).toBe(WEBSOCKET_MAX_PAYLOAD_BYTES);
  });
});
