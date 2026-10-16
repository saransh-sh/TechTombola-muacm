import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import type { FastifyInstance } from 'fastify';
import { and, eq } from 'drizzle-orm';
import { runMigrations } from '../../src/db/migrate.ts';
import { closeDb, getDb } from '../../src/db/client.ts';
import { buildApp } from '../../src/app.ts';
import { userRepository } from '../../src/modules/auth/user.repository.ts';
import { hashPassword, SESSION_COOKIE_NAME } from '../../src/modules/auth/auth.domain.ts';
import { resetCachedEnv } from '../../src/config/env.ts';
import { eventRepository } from '../../src/modules/events/event.repository.ts';
import { roundRepository } from '../../src/modules/rounds/round.repository.ts';
import { roundService } from '../../src/modules/rounds/round.service.ts';
import { drawService } from '../../src/modules/draws/draw.service.ts';
import { drawRepository } from '../../src/modules/draws/draw.repository.ts';
import { participantRepository } from '../../src/modules/participants/participant.repository.ts';
import { questionRepository } from '../../src/modules/questions/question.repository.ts';
import { ticketService } from '../../src/modules/tickets/ticket.service.ts';
import { claimService } from '../../src/modules/claims/claim.service.ts';
import { rounds, roundPatterns } from '../../src/db/schema/rounds.ts';
import { events } from '../../src/db/schema/events.ts';
import { claims } from '../../src/db/schema/claims.ts';
import { auditLogs } from '../../src/db/schema/audit.ts';

describe('Winner Evaluation and Claim Submission Integration', () => {
  const testDbUrl =
    process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/techtombola_test';

  let app: FastifyInstance;
  let adminUser: any;
  let adminCookie: string;

  let event1: any;

  let participantUser1: any;
  let participantProfile1: any;
  let participantCookie1: string;

  let participantUser2: any;
  let participantProfile2: any;
  let participantCookie2: string;

  function extractCookie(res: any, name: string): string | null {
    const setCookie = res.headers['set-cookie'];
    if (!setCookie) return null;
    const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
    for (const c of cookies) {
      const match = c.match(new RegExp(`^${name}=([^;]+)`));
      if (match) return match[1];
    }
    return null;
  }

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = testDbUrl;
    process.env.JWT_SECRET = 'test-jwt-secret-min-length-sufficient';
    process.env.SESSION_SECRET = 'test-session-secret-min-length-sufficient';
    process.env.CORS_ORIGIN = 'http://localhost:5173,http://localhost:3000';
    process.env.APP_URL = 'http://localhost:5173';

    resetCachedEnv();
    await closeDb();
    await runMigrations(testDbUrl);

    // Clean up stale active rounds and live events
    const db = getDb();
    await db.update(rounds).set({ status: 'COMPLETED' }).where(eq(rounds.status, 'ACTIVE'));
    await db.update(events).set({ status: 'COMPLETED' }).where(eq(events.status, 'LIVE'));

    // 1. Create Admin
    const adminPassword = await hashPassword('ClaimAdminPass123!');
    adminUser = await userRepository.create(
      {
        email: `claim_admin_${Date.now()}@test.internal`,
        passwordHash: adminPassword,
        name: 'Claim Admin',
        status: 'ACTIVE',
      },
      { role: 'ADMIN' }
    );

    // 2. Create Event
    event1 = await eventRepository.create({
      title: `Claim Event 1 ${Date.now()}`,
      status: 'READY',
    });

    // 3. Create Participants
    const participantPassword = await hashPassword('PartPass123!');
    participantProfile1 = await participantRepository.create(
      {
        email: `claim_part1_${Date.now()}@test.internal`,
        name: 'Claim Participant One',
        passwordHash: participantPassword,
      },
      {
        eventId: event1.id,
        externalId: `EXT_CLAIM1_${Date.now()}`,
      }
    );
    participantUser1 = await userRepository.findById(participantProfile1.userId);

    participantProfile2 = await participantRepository.create(
      {
        email: `claim_part2_${Date.now()}@test.internal`,
        name: 'Claim Participant Two',
        passwordHash: participantPassword,
      },
      {
        eventId: event1.id,
        externalId: `EXT_CLAIM2_${Date.now()}`,
      }
    );
    participantUser2 = await userRepository.findById(participantProfile2.userId);

    // 4. Initialize App
    app = await buildApp({ enableLogging: false });
    await app.ready();

    // 5. Logins
    const adminLoginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({ email: adminUser.email, password: 'ClaimAdminPass123!' }),
    });
    adminCookie = extractCookie(adminLoginRes, SESSION_COOKIE_NAME)!;

    const p1LoginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({ email: participantUser1.email, password: 'PartPass123!' }),
    });
    participantCookie1 = extractCookie(p1LoginRes, SESSION_COOKIE_NAME)!;

    const p2LoginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({ email: participantUser2.email, password: 'PartPass123!' }),
    });
    participantCookie2 = extractCookie(p2LoginRes, SESSION_COOKIE_NAME)!;
  });

  afterAll(async () => {
    try {
      const db = getDb();
      await db.update(rounds).set({ status: 'COMPLETED' }).where(eq(rounds.status, 'ACTIVE'));
      await db.update(events).set({ status: 'COMPLETED' }).where(eq(events.status, 'LIVE'));
    } catch {}
    if (app) await app.close();
    await closeDb();
  });

  let nextRoundSeq = 1;

  async function setupActiveRoundWithPatterns(
    patterns: Array<{ patternType: any; enabled: boolean; maxWinners: number; status?: string }>
  ) {
    const db = getDb();
    await db.update(rounds).set({ status: 'COMPLETED' }).where(eq(rounds.status, 'ACTIVE'));

    const round = await roundRepository.create(
      { eventId: event1.id, sequenceNumber: nextRoundSeq++, name: `Round ${Date.now()}_${nextRoundSeq}`, status: 'DRAFT' },
      patterns
    );

    const questions: any[] = [];
    const keys: any[] = [];

    // Create 18 questions (15 needed for ticket + 3 extra)
    for (let i = 1; i <= 18; i++) {
      const val = `CKEY_${i}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const key = await questionRepository.createKey(event1.id, val, val);
      const q = await questionRepository.createQuestion(round.id, key.id, `Clue for ${val}?`);
      keys.push(key);
      questions.push(q);
    }

    await ticketService.generateTickets({
      roundId: round.id,
      actorId: adminUser.id,
      idempotencyKey: `tickets_${round.id}`,
    });

    await roundService.readyRound(adminUser.id, round.id);
    await roundService.startRound(adminUser.id, round.id, `start_${round.id}`);

    const ticket1 = await ticketService.getParticipantTicket(participantUser1.id, round.id);
    const ticket2 = await ticketService.getParticipantTicket(participantUser2.id, round.id);

    return { round, questions, keys, ticket1, ticket2 };
  }

  it('evaluates EARLY_5 at 4 draws (rejects 422), 5 draws (accepts 200), and 6 draws (accepts 200)', async () => {
    const { round, ticket1, ticket2 } = await setupActiveRoundWithPatterns([
      { patternType: 'EARLY_5', enabled: true, maxWinners: 2 },
      { patternType: 'FULL_HOUSE', enabled: true, maxWinners: 1 },
    ]);

    const candidates = await drawRepository.getCandidateQuestions(round.id);

    // 1. Draw 4 keys from ticket1
    for (let i = 0; i < 4; i++) {
      const q = candidates.find((c) => c.keyId === ticket1.cells[i].keyId)!;
      await drawService.drawManual({
        actorId: adminUser.id,
        roundId: round.id,
        questionId: q.id,
        idempotencyKey: `draw_e5_${i}_${Date.now()}`,
      });
    }

    // Attempt claim EARLY_5 at 4 draws -> 422 Unprocessable Entity
    const resClaim4 = await app.inject({
      method: 'POST',
      url: '/api/v1/participant/claims',
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${participantCookie1}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ roundId: round.id, pattern: 'EARLY_5' }),
    });
    expect(resClaim4.statusCode).toBe(422);
    expect(resClaim4.json().error.code).toBe('CLAIM_INELIGIBLE');

    // 2. Draw 5th key from ticket1
    const q5 = candidates.find((c) => c.keyId === ticket1.cells[4].keyId)!;
    await drawService.drawManual({
      actorId: adminUser.id,
      roundId: round.id,
      questionId: q5.id,
      idempotencyKey: `draw_e5_5_${Date.now()}`,
    });

    // Attempt claim EARLY_5 at 5 draws -> 200 OK
    const resClaim5 = await app.inject({
      method: 'POST',
      url: '/api/v1/participant/claims',
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${participantCookie1}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ roundId: round.id, pattern: 'EARLY_5' }),
    });
    expect(resClaim5.statusCode).toBe(200);
    const body5 = resClaim5.json();
    expect(body5.claim.status).toBe('PENDING_VERIFICATION');
    expect(body5.claim.patternType).toBe('EARLY_5');
    expect(body5.claim.roundId).toBe(round.id);

    // 3. Draw 6th key from ticket1
    const q6 = candidates.find((c) => c.keyId === ticket1.cells[5].keyId)!;
    await drawService.drawManual({
      actorId: adminUser.id,
      roundId: round.id,
      questionId: q6.id,
      idempotencyKey: `draw_e5_6_${Date.now()}`,
    });

    // Participant 2 can also claim EARLY_5 if Participant 2 has at least 5 drawn keys
    // Draw 5 keys belonging to ticket 2
    let drawnForP2 = 0;
    for (const cell of ticket2.cells) {
      if (drawnForP2 >= 5) break;
      const alreadyDrawnIds = await drawRepository.getDrawnKeyIds(round.id);
      if (alreadyDrawnIds.has(cell.keyId)) {
        drawnForP2++;
      } else {
        const q = candidates.find((c) => c.keyId === cell.keyId);
        if (q) {
          await drawService.drawManual({
            actorId: adminUser.id,
            roundId: round.id,
            questionId: q.id,
            idempotencyKey: `draw_p2_${drawnForP2}_${Date.now()}`,
          });
          drawnForP2++;
        }
      }
    }

    const resClaimP2 = await app.inject({
      method: 'POST',
      url: '/api/v1/participant/claims',
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${participantCookie2}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ roundId: round.id, pattern: 'EARLY_5' }),
    });
    expect(resClaimP2.statusCode).toBe(200);
    expect(resClaimP2.json().claim.participantId).toBe(participantProfile2.id);

    await roundService.completeRound(adminUser.id, round.id);
  });

  it('proves that participant marks are completely irrelevant to winner evaluation', async () => {
    const { round, ticket1 } = await setupActiveRoundWithPatterns([
      { patternType: 'TOP_LINE', enabled: true, maxWinners: 1 },
      { patternType: 'FULL_HOUSE', enabled: true, maxWinners: 1 },
    ]);

    const candidates = await drawRepository.getCandidateQuestions(round.id);
    const row0Cells = ticket1.cells.filter((c: any) => c.rowIndex === 0);

    // Participant 1 marks NOTHING.
    // Officially draw all 5 keys of row 0
    for (let i = 0; i < 5; i++) {
      const q = candidates.find((c) => c.keyId === row0Cells[i].keyId)!;
      await drawService.drawManual({
        actorId: adminUser.id,
        roundId: round.id,
        questionId: q.id,
        idempotencyKey: `draw_top_${i}_${Date.now()}`,
      });
    }

    // Participant 1 has 0 marks on their ticket, but all 5 keys are drawn.
    // Claim must SUCCEED!
    const resClaim = await app.inject({
      method: 'POST',
      url: '/api/v1/participant/claims',
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${participantCookie1}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ roundId: round.id, pattern: 'TOP_LINE' }),
    });
    expect(resClaim.statusCode).toBe(200);
    expect(resClaim.json().claim.status).toBe('PENDING_VERIFICATION');

    await roundService.completeRound(adminUser.id, round.id);
  });

  it('evaluates FULL_HOUSE at 14 draws (rejects 422) and 15 draws (accepts 200)', async () => {
    const { round, ticket1 } = await setupActiveRoundWithPatterns([
      { patternType: 'FULL_HOUSE', enabled: true, maxWinners: 1 },
    ]);

    const candidates = await drawRepository.getCandidateQuestions(round.id);

    // Draw first 14 keys of ticket1
    for (let i = 0; i < 14; i++) {
      const q = candidates.find((c) => c.keyId === ticket1.cells[i].keyId)!;
      await drawService.drawManual({
        actorId: adminUser.id,
        roundId: round.id,
        questionId: q.id,
        idempotencyKey: `draw_fh_${i}_${Date.now()}`,
      });
    }

    // 14 draws -> 422
    const res14 = await app.inject({
      method: 'POST',
      url: '/api/v1/participant/claims',
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${participantCookie1}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ roundId: round.id, pattern: 'FULL_HOUSE' }),
    });
    expect(res14.statusCode).toBe(422);

    // Draw 15th key
    const q15 = candidates.find((c) => c.keyId === ticket1.cells[14].keyId)!;
    await drawService.drawManual({
      actorId: adminUser.id,
      roundId: round.id,
      questionId: q15.id,
      idempotencyKey: `draw_fh_15_${Date.now()}`,
    });

    // 15 draws -> 200
    const res15 = await app.inject({
      method: 'POST',
      url: '/api/v1/participant/claims',
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${participantCookie1}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ roundId: round.id, pattern: 'FULL_HOUSE' }),
    });
    expect(res15.statusCode).toBe(200);
    expect(res15.json().claim.patternType).toBe('FULL_HOUSE');

    await roundService.completeRound(adminUser.id, round.id);
  });

  it('rejects duplicate claims, disabled patterns, and closed patterns with 409', async () => {
    const { round, ticket1 } = await setupActiveRoundWithPatterns([
      { patternType: 'EARLY_5', enabled: true, maxWinners: 1 },
      { patternType: 'TOP_LINE', enabled: false, maxWinners: 1 },
      { patternType: 'FULL_HOUSE', enabled: true, maxWinners: 1 },
    ]);

    const candidates = await drawRepository.getCandidateQuestions(round.id);

    // Draw 5 keys for EARLY_5
    for (let i = 0; i < 5; i++) {
      const q = candidates.find((c) => c.keyId === ticket1.cells[i].keyId)!;
      await drawService.drawManual({
        actorId: adminUser.id,
        roundId: round.id,
        questionId: q.id,
        idempotencyKey: `draw_err_${i}_${Date.now()}`,
      });
    }

    // 1. Claim EARLY_5 first time -> 200
    const resClaim1 = await app.inject({
      method: 'POST',
      url: '/api/v1/participant/claims',
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${participantCookie1}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ roundId: round.id, pattern: 'EARLY_5' }),
    });
    expect(resClaim1.statusCode).toBe(200);

    // 2. Duplicate claim by same participant -> 409 CLAIM_ALREADY_EXISTS
    const resDup = await app.inject({
      method: 'POST',
      url: '/api/v1/participant/claims',
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${participantCookie1}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ roundId: round.id, pattern: 'EARLY_5' }),
    });
    expect(resDup.statusCode).toBe(409);
    expect(resDup.json().error.code).toBe('CLAIM_ALREADY_EXISTS');

    // 3. Claim on DISABLED pattern (TOP_LINE) -> 409 PATTERN_DISABLED
    const resDisabled = await app.inject({
      method: 'POST',
      url: '/api/v1/participant/claims',
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${participantCookie1}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ roundId: round.id, pattern: 'TOP_LINE' }),
    });
    expect(resDisabled.statusCode).toBe(409);
    expect(resDisabled.json().error.code).toBe('PATTERN_DISABLED');

    // 4. Close FULL_HOUSE pattern and attempt claim -> 409 PATTERN_CLOSED
    const db = getDb();
    await db
      .update(roundPatterns)
      .set({ status: 'CLOSED' })
      .where(and(eq(roundPatterns.roundId, round.id), eq(roundPatterns.patternType, 'FULL_HOUSE')));

    const resClosed = await app.inject({
      method: 'POST',
      url: '/api/v1/participant/claims',
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${participantCookie1}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ roundId: round.id, pattern: 'FULL_HOUSE' }),
    });
    expect(resClosed.statusCode).toBe(409);
    expect(resClosed.json().error.code).toBe('PATTERN_CLOSED');

    await roundService.completeRound(adminUser.id, round.id);
  });

  it('rejects claim when round is not in ACTIVE status', async () => {
    const { round } = await setupActiveRoundWithPatterns([
      { patternType: 'EARLY_5', enabled: true, maxWinners: 1 },
      { patternType: 'FULL_HOUSE', enabled: true, maxWinners: 1 },
    ]);

    await roundService.pauseRound(adminUser.id, round.id);

    const resClaimPaused = await app.inject({
      method: 'POST',
      url: '/api/v1/participant/claims',
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${participantCookie1}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ roundId: round.id, pattern: 'EARLY_5' }),
    });
    expect(resClaimPaused.statusCode).toBe(409);
    expect(resClaimPaused.json().error.code).toBe('ROUND_NOT_ACTIVE');

    await roundService.cancelRound(adminUser.id, round.id);
  });

  it('lists participant claims with scope isolation and audit trail', async () => {
    const { round, ticket1 } = await setupActiveRoundWithPatterns([
      { patternType: 'EARLY_5', enabled: true, maxWinners: 2 },
      { patternType: 'FULL_HOUSE', enabled: true, maxWinners: 1 },
    ]);

    const candidates = await drawRepository.getCandidateQuestions(round.id);
    for (let i = 0; i < 5; i++) {
      const q = candidates.find((c) => c.keyId === ticket1.cells[i].keyId)!;
      await drawService.drawManual({
        actorId: adminUser.id,
        roundId: round.id,
        questionId: q.id,
        idempotencyKey: `draw_iso_${i}_${Date.now()}`,
      });
    }

    // Submit claim as Participant 1
    const resClaim = await app.inject({
      method: 'POST',
      url: '/api/v1/participant/claims',
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${participantCookie1}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ roundId: round.id, pattern: 'EARLY_5' }),
    });
    expect(resClaim.statusCode).toBe(200);
    const claimId = resClaim.json().claim.id;

    // 1. Participant 1 retrieves claims: sees their claim
    const resP1Claims = await app.inject({
      method: 'GET',
      url: '/api/v1/participant/claims',
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${participantCookie1}`,
      },
    });
    expect(resP1Claims.statusCode).toBe(200);
    const p1ClaimIds = resP1Claims.json().data.map((c: any) => c.id);
    expect(p1ClaimIds).toContain(claimId);

    // 2. Participant 2 retrieves claims: does NOT see Participant 1's claim (scope isolation!)
    const resP2Claims = await app.inject({
      method: 'GET',
      url: '/api/v1/participant/claims',
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${participantCookie2}`,
      },
    });
    expect(resP2Claims.statusCode).toBe(200);
    const p2ClaimIds = resP2Claims.json().data.map((c: any) => c.id);
    expect(p2ClaimIds).not.toContain(claimId);

    // 3. Verify audit log entry
    const db = getDb();
    const [auditEntry] = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.action, 'WIN_CLAIM_CREATED'), eq(auditLogs.resourceId, claimId)));
    expect(auditEntry).toBeDefined();
    expect(auditEntry.actorType).toBe('PARTICIPANT');

    await roundService.completeRound(adminUser.id, round.id);
  });

  it('broadcasts WIN_CLAIM_CREATED via realtime transport post-commit', async () => {
    const { round, ticket1 } = await setupActiveRoundWithPatterns([
      { patternType: 'EARLY_5', enabled: true, maxWinners: 1 },
      { patternType: 'FULL_HOUSE', enabled: true, maxWinners: 1 },
    ]);

    const candidates = await drawRepository.getCandidateQuestions(round.id);
    for (let i = 0; i < 5; i++) {
      const q = candidates.find((c) => c.keyId === ticket1.cells[i].keyId)!;
      await drawService.drawManual({
        actorId: adminUser.id,
        roundId: round.id,
        questionId: q.id,
        idempotencyKey: `draw_bc_${i}_${Date.now()}`,
      });
    }

    let broadcastedEvent: any = null;
    const publisher = {
      broadcastCommitted: async (ev: any) => {
        broadcastedEvent = ev;
      },
    };
    claimService.setRealtimePublisher(publisher);

    const resClaim = await app.inject({
      method: 'POST',
      url: '/api/v1/participant/claims',
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${participantCookie1}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ roundId: round.id, pattern: 'EARLY_5' }),
    });
    expect(resClaim.statusCode).toBe(200);

    expect(broadcastedEvent).not.toBeNull();
    expect(broadcastedEvent.type).toBe('WIN_CLAIM_CREATED');
    expect(broadcastedEvent.roundId).toBe(round.id);
    expect(broadcastedEvent.payload.pattern).toBe('EARLY_5');
    expect(broadcastedEvent.payload.claimId).toBe(resClaim.json().claim.id);

    await roundService.completeRound(adminUser.id, round.id);
  });
});
