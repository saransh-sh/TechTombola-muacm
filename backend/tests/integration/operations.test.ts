import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { closeDb, getDb, getSqlClient } from '../../src/db/client.ts';
import { runMigrations } from '../../src/db/migrate.ts';
import { auditLogs } from '../../src/db/schema/audit.ts';
import { events } from '../../src/db/schema/events.ts';
import { rounds } from '../../src/db/schema/rounds.ts';
import { participantProfiles, users } from '../../src/db/schema/users.ts';
import { OperationsRepository } from '../../src/modules/operations/operations.repository.ts';
import { buildApp } from '../../src/app.ts';
import { SESSION_COOKIE_NAME, hashPassword } from '../../src/modules/auth/auth.domain.ts';
import { userRepository } from '../../src/modules/auth/user.repository.ts';
import { resetCachedEnv } from '../../src/config/env.ts';
import type { FastifyInstance } from 'fastify';

describe('Operations read repository integration', () => {
  const testDbUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/techtombola_test';
  const repository = new OperationsRepository();
  let app: FastifyInstance;
  const roleTestPassword = 'OperationsRoleTest123!';
  const roleEmails = {
    admin: `${crypto.randomUUID()}@operations.test`,
    superAdmin: `${crypto.randomUUID()}@operations.test`,
    participant: `${crypto.randomUUID()}@operations.test`,
  };

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = testDbUrl;
    process.env.JWT_SECRET = 'test-jwt-secret-min-length-sufficient';
    process.env.SESSION_SECRET = 'test-session-secret-min-length-sufficient';
    resetCachedEnv();
    await closeDb();
    await runMigrations(testDbUrl);
    const passwordHash = await hashPassword(roleTestPassword);
    await userRepository.create({ email: roleEmails.admin, passwordHash, name: 'Operations Admin', status: 'ACTIVE' }, { role: 'ADMIN' });
    await userRepository.create({ email: roleEmails.superAdmin, passwordHash, name: 'Operations Super Admin', status: 'ACTIVE' }, { role: 'SUPER_ADMIN' });
    const participant = await userRepository.create({ email: roleEmails.participant, passwordHash, name: 'Operations Participant', status: 'ACTIVE' });
    const [participantEvent] = await getDb().insert(events).values({ title: `Role test ${crypto.randomUUID()}`, status: 'DRAFT' }).returning();
    await getDb().insert(participantProfiles).values({ userId: participant.id, eventId: participantEvent.id });
    app = await buildApp({ enableLogging: false });
    await app.ready();
  });

  afterAll(async () => { await app?.close(); await closeDb(); });

  async function loginCookie(email: string): Promise<string> {
    const response = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email, password: roleTestPassword } });
    expect(response.statusCode).toBe(200);
    const setCookie = response.headers['set-cookie'];
    const cookieHeader = Array.isArray(setCookie) ? setCookie.find((value) => value.startsWith(`${SESSION_COOKIE_NAME}=`)) : setCookie;
    expect(cookieHeader).toBeDefined();
    return cookieHeader!.split(';')[0];
  }

  it('enforces Participant, Admin, and Super Admin scopes on operational endpoints', async () => {
    const [participantCookie, adminCookie, superAdminCookie] = await Promise.all([
      loginCookie(roleEmails.participant), loginCookie(roleEmails.admin), loginCookie(roleEmails.superAdmin),
    ]);
    const request = (url: string, cookie: string) => app.inject({ method: 'GET', url, headers: { cookie } });

    expect((await request('/api/v1/admin/dashboard', participantCookie)).statusCode).toBe(403);
    expect((await request('/api/v1/admin/audit', participantCookie)).statusCode).toBe(403);
    expect((await request('/api/v1/super-admin/system', participantCookie)).statusCode).toBe(403);
    expect((await request('/api/v1/admin/dashboard', adminCookie)).statusCode).toBe(200);
    expect((await request('/api/v1/admin/audit', adminCookie)).statusCode).toBe(200);
    expect((await request('/api/v1/super-admin/system', adminCookie)).statusCode).toBe(403);
    expect((await request('/api/v1/admin/dashboard', superAdminCookie)).statusCode).toBe(200);
    expect((await request('/api/v1/super-admin/system', superAdminCookie)).statusCode).toBe(200);
  });

  it('reads only the current LIVE Event and all its Round states from one repeatable-read snapshot', async () => {
    const db = getDb();
    const liveEventId = crypto.randomUUID();
    const otherEventId = crypto.randomUUID();
    const liveEventTitle = `Operations live ${liveEventId}`;
    const otherEventTitle = `Operations other ${otherEventId}`;
    const [liveEvent, otherEvent] = await db.insert(events).values([
      { id: liveEventId, title: liveEventTitle, status: 'LIVE' },
      { id: otherEventId, title: otherEventTitle, status: 'DRAFT' },
    ]).returning();
    const liveRoundId = crypto.randomUUID();
    await db.insert(rounds).values([
      { id: liveRoundId, eventId: liveEvent.id, sequenceNumber: 1, name: 'Active Round', status: 'ACTIVE' },
      { eventId: liveEvent.id, sequenceNumber: 2, name: 'Recovery Round', status: 'RECOVERY_REQUIRED' },
      { eventId: otherEvent.id, sequenceNumber: 9, name: 'Other Event Round', status: 'RECOVERY_REQUIRED' },
    ]);
    const profiles = await db.insert(users).values([
      { email: `${liveEventId}-1@example.test`, name: 'Participant 1', passwordHash: 'hash' },
      { email: `${liveEventId}-2@example.test`, name: 'Participant 2', passwordHash: 'hash' },
      { email: `${otherEventId}-1@example.test`, name: 'Other Participant', passwordHash: 'hash' },
    ]).returning();
    await db.insert(participantProfiles).values([
      { userId: profiles[0].id, eventId: liveEvent.id },
      { userId: profiles[1].id, eventId: liveEvent.id },
      { userId: profiles[2].id, eventId: otherEvent.id },
    ]);

    const dashboard = await repository.getDashboard();
    expect(dashboard.event).toMatchObject({ id: liveEventId, title: liveEventTitle, status: 'LIVE' });
    expect(dashboard.round).toMatchObject({ name: 'Recovery Round', sequenceNumber: 2, status: 'RECOVERY_REQUIRED' });
    expect(dashboard.participants).toBe(2);
    expect(dashboard.drawCount).toBe(0);
    expect(dashboard.pendingClaims).toBe(0);
    expect(dashboard.verifiedWinners).toBe(0);
    expect(dashboard.recoveryRequired).toBe(true);
    expect(dashboard.systemStatus).toBe('recovery_required');
  });

  it('paginates audit ties deterministically and has supporting composite indexes', async () => {
    const actorId = crypto.randomUUID();
    const at = new Date('2026-10-15T12:00:00.000Z');
    const ids = [
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
      '33333333-3333-4333-8333-333333333333',
    ];
    await getDb().insert(auditLogs).values(ids.map((id) => ({
      id, actorId, actorType: 'ADMIN', action: 'DRAW_CREATED', resourceType: 'round', resourceId: 'ops-page-test',
      metadata: { note: 'redacted fixture' }, ip: '192.0.2.1', userAgent: 'test agent', requestId: 'test request', createdAt: at,
    })));
    await getDb().insert(auditLogs).values({
      actorId, actorType: 'ADMIN', action: 'LOGIN_SUCCESS', resourceType: 'auth', resourceId: null,
      metadata: null, createdAt: new Date(at.getTime() + 1000),
    });

    const filters = { page: 1, limit: 2, actorId, action: 'DRAW_CREATED', from: at, to: at };
    const firstPage = await repository.listAudit(filters);
    const secondPage = await repository.listAudit({ ...filters, page: 2 });
    expect(firstPage.map((row) => row.id)).toEqual([ids[2], ids[1], ids[0]].slice(0, 3));
    expect(secondPage.map((row) => row.id)).toEqual([ids[0]]);
    expect(firstPage.every((row) => row.ip === '192.0.2.1')).toBe(true);

    const indexes = await getSqlClient()`SELECT indexname FROM pg_indexes WHERE tablename = 'audit_logs'`;
    const indexNames = indexes.map((row) => row.indexname);
    expect(indexNames).toContain('audit_logs_created_id_idx');
    expect(indexNames).toContain('audit_logs_actor_created_id_idx');
    expect(indexNames).toContain('audit_logs_action_created_id_idx');
  });
});
