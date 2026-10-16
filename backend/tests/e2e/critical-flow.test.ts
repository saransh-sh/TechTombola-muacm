import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import postgres from 'postgres';
import { createServer } from 'node:net';
import { join } from 'node:path';
import WebSocket from 'ws';

const baseDatabaseUrl = process.env.E2E_DATABASE_URL;
const bootstrapSecret = 'issue-20-e2e-bootstrap-secret-must-be-at-least-32-chars';
const emailApiKey = 'issue-20-fake-email-api-key';
const patterns = ['EARLY_5', 'TOP_LINE', 'MIDDLE_LINE', 'BOTTOM_LINE', 'FULL_HOUSE'] as const;
let databaseName = '';
let baseUrl = '';
let serverProcess: Bun.Subprocess | undefined;
let provider: ReturnType<typeof Bun.serve>;
let providerMessages: Array<{ to: string; subject: string; text: string }> = [];
let serverOutput = '';

function assertStep<T extends { status: number; body: any; requestId?: string }>(step: string, response: T, expected: number): T {
  if (response.status !== expected) {
    throw new Error(`${step} failed (requestId=${response.requestId ?? 'missing'}, status=${response.status}): ${JSON.stringify(response.body)}\n${serverOutput}`);
  }
  return response;
}

async function reservePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Could not reserve a test port');
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return address.port;
}

async function api(method: string, path: string, options: { cookie?: string; body?: unknown; headers?: Record<string, string> } = {}) {
  const response = await fetch(`${baseUrl}/api/v1${path}`, {
    method,
    headers: {
      ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(options.cookie ? { cookie: options.cookie } : {}),
      ...(options.headers ?? {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const raw = await response.text();
  let body: any;
  try { body = raw ? JSON.parse(raw) : null; } catch { body = raw; }
  return { status: response.status, body, requestId: response.headers.get('x-request-id') ?? undefined, headers: response.headers };
}

async function login(email: string, password: string) {
  const response = assertStep(`login ${email}`, await api('POST', '/auth/login', { body: { email, password } }), 200);
  const token = response.headers.get('set-cookie')?.match(/session_token=([^;]+)/)?.[1];
  if (!token) throw new Error(`login ${email} did not set a session cookie`);
  return { cookie: `session_token=${token}`, user: response.body.user };
}

describe('Issue 20 production-server critical flows', () => {
  beforeAll(async () => {
    if (!baseDatabaseUrl) throw new Error('E2E_DATABASE_URL must point to an isolated-capable PostgreSQL server database');
    const adminSql = postgres(baseDatabaseUrl, { max: 1, connect_timeout: 5 });
    databaseName = `tt_issue20_${crypto.randomUUID().replaceAll('-', '')}`;
    await adminSql.unsafe(`CREATE DATABASE "${databaseName}"`);
    await adminSql.end();
    const dbUrl = new URL(baseDatabaseUrl);
    dbUrl.pathname = `/${databaseName}`;

    providerMessages = [];
    provider = Bun.serve({
      port: 0,
      hostname: '127.0.0.1',
      async fetch(request) {
        if (request.method !== 'POST' || request.headers.get('authorization') !== `Bearer ${emailApiKey}`) return new Response('unauthorized', { status: 401 });
        providerMessages.push(await request.json() as { to: string; subject: string; text: string });
        return Response.json({ accepted: true }, { status: 202 });
      },
    });

    const env = {
      ...process.env,
      NODE_ENV: 'test', DATABASE_URL: dbUrl.toString(), PORT: String(await reservePort()), HOST: '127.0.0.1',
      JWT_SECRET: 'issue-20-e2e-jwt-secret-must-be-at-least-32-characters',
      SESSION_SECRET: 'issue-20-e2e-session-secret-must-be-at-least-32-chars',
      EMAIL_PROVIDER_API_KEY: emailApiKey, EMAIL_PROVIDER_URL: `http://127.0.0.1:${provider.port}/send`,
      SUPER_ADMIN_BOOTSTRAP_SECRET: bootstrapSecret, CORS_ORIGIN: '*', LOG_LEVEL: 'silent',
    };
    const backendRoot = join(import.meta.dir, '..', '..');
    const migrate = Bun.spawn(['bun', 'src/db/migrate.ts'], { cwd: backendRoot, env, stdout: 'pipe', stderr: 'pipe' });
    const migrationOutput = await new Response(migrate.stdout).text();
    const migrationError = await new Response(migrate.stderr).text();
    if (await migrate.exited !== 0) throw new Error(`isolated DB migration failed: ${migrationOutput}\n${migrationError}`);

    serverProcess = Bun.spawn(['bun', 'dist/server.js'], { cwd: backendRoot, env, stdout: 'pipe', stderr: 'pipe' });
    if (!(serverProcess.stdout instanceof ReadableStream) || !(serverProcess.stderr instanceof ReadableStream)) {
      throw new Error('Could not capture built backend output');
    }
    const collect = async (stream: ReadableStream<Uint8Array>) => {
      const reader = stream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) return;
        serverOutput += new TextDecoder().decode(value);
      }
    };
    void collect(serverProcess.stdout);
    void collect(serverProcess.stderr);
    baseUrl = `http://127.0.0.1:${env.PORT}`;
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      try { if ((await fetch(`${baseUrl}/health`)).ok) return; } catch { /* wait for startup */ }
      await Bun.sleep(150);
    }
    throw new Error(`built backend did not become healthy: ${serverOutput}`);
  }, 30000);

  afterAll(async () => {
    provider?.stop(true);
    if (serverProcess && serverProcess.exitCode === null) {
      serverProcess.kill('SIGTERM');
      await Promise.race([serverProcess.exited, Bun.sleep(5000)]);
      if (serverProcess.exitCode === null) serverProcess.kill('SIGKILL');
    }
    if (baseDatabaseUrl && databaseName) {
      const adminSql = postgres(baseDatabaseUrl, { max: 1, connect_timeout: 5 });
      await adminSql.unsafe(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
      const [databaseStillExists] = await adminSql<{ present: boolean }[]>`
        SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = ${databaseName}) AS present
      `;
      expect(databaseStillExists.present).toBe(false);
      await adminSql.end();
    }
  });

  it('bootstraps, configures, plays, recovers, verifies all Patterns, and completes', async () => {
    const superEmail = `super-${crypto.randomUUID()}@issue20.test`;
    const superPassword = 'Super-admin-password-20!';
    const bootstrap = assertStep('bootstrap first Super Admin', await api('POST', '/auth/bootstrap-super-admin', {
      headers: { 'x-bootstrap-secret': bootstrapSecret },
      body: { email: superEmail, name: 'Issue 20 Super Admin', password: superPassword },
    }), 201);
    expect(bootstrap.body.user.role).toBe('SUPER_ADMIN');
    assertStep('reject bootstrap replay', await api('POST', '/auth/bootstrap-super-admin', {
      headers: { 'x-bootstrap-secret': bootstrapSecret },
      body: { email: `replay-${superEmail}`, name: 'Replay', password: superPassword },
    }), 409);
    assertStep('reject incorrect bootstrap secret', await api('POST', '/auth/bootstrap-super-admin', {
      headers: { 'x-bootstrap-secret': 'wrong' },
      body: { email: `wrong-${superEmail}`, name: 'Wrong Secret', password: superPassword },
    }), 401);

    const superAdmin = await login(superEmail, superPassword);
    const adminEmail = `admin-${crypto.randomUUID()}@issue20.test`;
    const adminCreated = assertStep('create Admin', await api('POST', '/super-admin/admins', {
      cookie: superAdmin.cookie, body: { email: adminEmail, name: 'Issue 20 Admin', role: 'ADMIN' },
    }), 201).body;
    const admin = await login(adminEmail, adminCreated.temporaryPassword);
    const event = assertStep('create Event', await api('POST', '/admin/events', {
      cookie: admin.cookie, body: { title: 'Issue 20 Critical Flow' },
    }), 201).body;

    const keys: any[] = [];
    for (let index = 0; index < 15; index++) {
      keys.push(assertStep(`create Key ${index + 1}`, await api('POST', '/admin/keys', {
        cookie: admin.cookie, body: { eventId: event.id, value: `ISSUE20_KEY_${String(index + 1).padStart(2, '0')}` },
      }), 201).body.key);
    }
    const round = assertStep('create Round with five Patterns', await api('POST', '/admin/rounds', {
      cookie: admin.cookie,
      body: { eventId: event.id, sequenceNumber: 1, name: 'Critical Flow Round', patterns: patterns.map((patternType) => ({ patternType, enabled: true, maxWinners: 1 })) },
    }), 201).body.round;
    const questions: any[] = [];
    for (const [index, key] of keys.entries()) {
      questions.push(assertStep(`create Question ${index + 1}`, await api('POST', '/admin/questions', {
        cookie: admin.cookie,
        body: { roundId: round.id, keyId: key.id, questionText: `Which technology is represented by clue number ${index + 1}?` },
      }), 201).body.question);
    }

    const participants: Array<{ email: string; cookie: string }> = [];
    for (let index = 0; index < 5; index++) {
      const email = `participant-${index}-${crypto.randomUUID()}@issue20.test`;
      assertStep(`create Participant ${index + 1}`, await api('POST', '/admin/participants', {
        cookie: admin.cookie, body: { eventId: event.id, email, name: `Issue 20 Participant ${index + 1}` },
      }), 201);
      const delivery = providerMessages.find((message) => message.to === email);
      expect(delivery?.subject).toContain('Issue 20 Critical Flow');
      const password = delivery?.text.match(/temporary password is: (.+)/)?.[1];
      expect(password).toBeTruthy();
      participants.push({ email, cookie: (await login(email, password!)).cookie });
    }

    const generationKey = `ticket-generation-${crypto.randomUUID()}`;
    const generated = assertStep('generate Tickets', await api('POST', `/admin/rounds/${round.id}/tickets/generate`, {
      cookie: admin.cookie, headers: { 'idempotency-key': generationKey },
    }), 200).body;
    expect(generated.created).toBe(5);
    expect(assertStep('replay Ticket generation', await api('POST', `/admin/rounds/${round.id}/tickets/generate`, {
      cookie: admin.cookie, headers: { 'idempotency-key': generationKey },
    }), 200).body).toEqual(generated);
    assertStep('mark Event ready', await api('PATCH', `/admin/events/${event.id}`, { cookie: admin.cookie, body: { status: 'READY' } }), 200);
    assertStep('mark Round ready', await api('POST', `/admin/rounds/${round.id}/ready`, { cookie: admin.cookie }), 200);
    const startHeaders = { 'idempotency-key': `round-start-${crypto.randomUUID()}` };
    assertStep('start Round', await api('POST', `/admin/rounds/${round.id}/start`, {
      cookie: admin.cookie, headers: startHeaders,
    }), 200);
    assertStep('replay Round start idempotently', await api('POST', `/admin/rounds/${round.id}/start`, {
      cookie: admin.cookie, headers: startHeaders,
    }), 200);
    const ticket = assertStep('read own Ticket', await api('GET', `/participant/ticket?roundId=${round.id}`, { cookie: participants[0].cookie }), 200).body.ticket;
    expect(ticket.cells).toHaveLength(15);
    const otherTicket = assertStep('read second Participant Ticket', await api('GET', `/participant/ticket?roundId=${round.id}`, {
      cookie: participants[1].cookie,
    }), 200).body.ticket;
    expect(otherTicket.id).not.toBe(ticket.id);
    const ticketReadCannotBeRedirected = assertStep('ignore another Ticket identifier on Participant read', await api('GET', `/participant/ticket?roundId=${round.id}&ticketId=${ticket.id}`, {
      cookie: participants[1].cookie,
    }), 200).body.ticket;
    expect(ticketReadCannotBeRedirected.id).toBe(otherTicket.id);
    const beforeAnyDraw = assertStep('hide future Draws', await api('GET', `/participant/draws?roundId=${round.id}`, {
      cookie: participants[0].cookie,
    }), 200).body;
    expect((beforeAnyDraw.data ?? beforeAnyDraw.draws ?? beforeAnyDraw).length).toBe(0);
    assertStep('reject undrawn Mark', await api('POST', `/participant/tickets/${ticket.id}/marks`, {
      cookie: participants[0].cookie, body: { cellId: ticket.cells[0].id },
    }), 422);
    assertStep('reject ineligible Claim', await api('POST', '/participant/claims', {
      cookie: participants[0].cookie, body: { roundId: round.id, pattern: 'FULL_HOUSE' },
    }), 422);

    const ws = new WebSocket(`${baseUrl.replace('http', 'ws')}/api/v1/ws?roundId=${round.id}`, { headers: { cookie: participants[0].cookie } });
    const events: any[] = [];
    ws.on('message', (message) => events.push(JSON.parse(message.toString())));
    await new Promise<void>((resolve, reject) => {
      ws.once('open', resolve); ws.once('error', reject);
      setTimeout(() => reject(new Error('WebSocket connection timed out')), 5000);
    });
    const adminWs = new WebSocket(`${baseUrl.replace('http', 'ws')}/api/v1/ws?eventId=${event.id}&roundId=${round.id}`, { headers: { cookie: admin.cookie } });
    const adminEvents: any[] = [];
    adminWs.on('message', (message) => adminEvents.push(JSON.parse(message.toString())));
    await new Promise<void>((resolve, reject) => {
      adminWs.once('open', resolve); adminWs.once('error', reject);
      setTimeout(() => reject(new Error('Admin WebSocket connection timed out')), 5000);
    });
    const disconnected = new Promise<void>((resolve) => ws.once('close', () => resolve()));
    ws.close();
    await disconnected;
    const randomKey = `random-draw-${crypto.randomUUID()}`;
    const random = assertStep('create random Draw', await api('POST', `/admin/rounds/${round.id}/draws`, {
      cookie: admin.cookie, headers: { 'idempotency-key': randomKey },
    }), 200).body.draw;
    const replay = assertStep('replay random Draw', await api('POST', `/admin/rounds/${round.id}/draws`, {
      cookie: admin.cookie, headers: { 'idempotency-key': randomKey },
    }), 200).body.draw;
    expect(replay.id).toBe(random.id);
    const disconnectedState = assertStep('converge from REST after disconnect', await api('GET', `/participant/draws?roundId=${round.id}`, {
      cookie: participants[0].cookie,
    }), 200).body;
    const disconnectedDraws = disconnectedState.data ?? disconnectedState.draws ?? disconnectedState;
    expect(disconnectedDraws.some((draw: any) => draw.id === random.id)).toBe(true);
    expect(disconnectedDraws).toHaveLength(1);
    expect(disconnectedDraws[0].keyId).toBe(random.keyId);
    expect(disconnectedDraws[0].questionId).toBe(random.questionId);

    const reconnected = new WebSocket(`${baseUrl.replace('http', 'ws')}/api/v1/ws?roundId=${round.id}`, { headers: { cookie: participants[0].cookie } });
    reconnected.on('message', (message) => events.push(JSON.parse(message.toString())));
    await new Promise<void>((resolve, reject) => {
      reconnected.once('open', resolve); reconnected.once('error', reject);
      setTimeout(() => reject(new Error('WebSocket reconnect timed out')), 5000);
    });
    const drawn = new Set([random.questionId]);
    const allDraws = [random];
    for (const question of questions) {
      if (drawn.has(question.id)) continue;
      const manual = assertStep(`manual Draw ${question.id}`, await api('POST', `/admin/rounds/${round.id}/draws/manual`, {
        cookie: admin.cookie, headers: { 'idempotency-key': `manual-${crypto.randomUUID()}` }, body: { questionId: question.id },
      }), 200).body.draw;
      drawn.add(manual.questionId);
      allDraws.push(manual);
    }
    expect(drawn.size).toBe(15);
    await Bun.sleep(150);
    expect(events.some((event) => event.type === 'DRAW_CREATED')).toBe(true);

    const restState = assertStep('reconnect state through Draws REST', await api('GET', `/participant/draws?roundId=${round.id}`, {
      cookie: participants[0].cookie,
    }), 200).body;
    const drawList = restState.data ?? restState.draws ?? restState;
    expect(drawList.length).toBe(15);
    assertStep('deny cross-Participant Ticket access', await api('POST', `/participant/tickets/${ticket.id}/marks`, {
      cookie: participants[1].cookie, body: { cellId: ticket.cells[0].id },
    }), 404);

    const participantTickets = [ticket, otherTicket];
    for (let index = 2; index < participants.length; index++) {
      participantTickets.push(assertStep(`read Participant ${index + 1} Ticket`, await api('GET', `/participant/ticket?roundId=${round.id}`, {
        cookie: participants[index].cookie,
      }), 200).body.ticket);
    }
    const patternCells = [
      participantTickets[0].cells.slice(0, 5),
      [...participantTickets[1].cells.slice(0, 5), ...participantTickets[1].cells.filter((cell: any) => cell.rowIndex === 0)],
      participantTickets[2].cells.filter((cell: any) => cell.rowIndex === 1),
      participantTickets[3].cells.filter((cell: any) => cell.rowIndex === 2),
      participantTickets[4].cells,
    ];
    const markedCellIds = new Set<string>();
    for (let index = 0; index < patternCells.length; index++) {
      for (const cell of patternCells[index]) {
        if (markedCellIds.has(cell.id)) continue;
        markedCellIds.add(cell.id);
        assertStep(`mark Participant ${index + 1} cell ${cell.id}`, await api('POST', `/participant/tickets/${participantTickets[index].id}/marks`, {
          cookie: participants[index].cookie, body: { cellId: cell.id },
        }), 200);
      }
    }

    for (const [index, pattern] of patterns.entries()) {
      const claim = assertStep(`Participant ${index + 1} claims ${pattern}`, await api('POST', '/participant/claims', {
        cookie: participants[index].cookie, body: { roundId: round.id, pattern },
      }), 200).body.claim;
      assertStep(`verify ${pattern}`, await api('POST', `/admin/claims/${claim.id}/verify`, {
        cookie: admin.cookie, headers: { 'idempotency-key': `verify-${pattern}-${crypto.randomUUID()}` },
      }), 200);
      if (pattern === 'EARLY_5') {
        assertStep('reject eligible competing Early 5 Winner after pattern closes', await api('POST', '/participant/claims', {
          cookie: participants[1].cookie, body: { roundId: round.id, pattern: 'EARLY_5' },
        }), 409);
      }
    }
    assertStep('complete Round', await api('POST', `/admin/rounds/${round.id}/complete`, { cookie: admin.cookie }), 200);
    expect(assertStep('read final Round state', await api('GET', `/admin/rounds/${round.id}`, { cookie: admin.cookie }), 200).body.round.status).toBe('COMPLETED');
    await Bun.sleep(100);
    const firstAuditPage = assertStep('read first workflow audit page', await api('GET', '/admin/audit?page=1&limit=100', { cookie: admin.cookie }), 200).body;
    const secondAuditPage = assertStep('read remaining workflow audit page', await api('GET', '/admin/audit?page=2&limit=100', { cookie: admin.cookie }), 200).body;
    const auditPage = { items: [...firstAuditPage.items, ...secondAuditPage.items] };
    const actionCount = (action: string) => auditPage.items.filter((item: any) => item.action === action).length;
    expect(actionCount('SUPER_ADMIN_BOOTSTRAPPED')).toBe(1);
    expect(actionCount('LOGIN_SUCCESS')).toBe(7);
    expect(actionCount('PARTICIPANT_CREATED')).toBe(6);
    expect(actionCount('KEY_CREATED')).toBe(15);
    expect(actionCount('QUESTION_CREATED')).toBe(15);
    expect(actionCount('TICKET_GENERATED')).toBe(1);
    expect(actionCount('ROUND_STARTED')).toBe(5);
    expect(actionCount('DRAW_CREATED')).toBe(1);
    expect(actionCount('MANUAL_DRAW_CREATED')).toBe(14);
    expect(actionCount('MARK_CREATED')).toBe(markedCellIds.size);
    expect(actionCount('WIN_CLAIM_CREATED')).toBe(5);
    expect(actionCount('WIN_VERIFIED')).toBe(5);
    expect(actionCount('ROUND_COMPLETED')).toBe(1);
    expect(auditPage.items).toHaveLength(77 + markedCellIds.size);
    expect(auditPage.items.filter((item: any) => item.resourceType === 'round' && item.resourceId === round.id && item.action === 'ROUND_STARTED' && item.metadata?.toStatus === 'ACTIVE')).toHaveLength(1);
    expect(events.filter((event) => event.type === 'DRAW_CREATED')).toHaveLength(14);
    for (const event of events.filter((item) => item.type === 'DRAW_CREATED')) {
      expect(event.eventId).toBe(event.id);
      expect(event.roundId).toBe(round.id);
      expect(allDraws.some((draw) => draw.keyValue === event.payload.key && draw.questionText === event.payload.question)).toBe(true);
    }
    expect(events.filter((event) => event.type === 'WINNER_VERIFIED')).toHaveLength(5);
    expect(events.filter((event) => event.type === 'ROUND_COMPLETED')).toHaveLength(1);
    expect(events.some((event) => event.type === 'WIN_CLAIM_CREATED')).toBe(false);
    expect(adminEvents.filter((event) => event.type === 'WIN_CLAIM_CREATED')).toHaveLength(5);
    expect(adminEvents.filter((event) => event.type === 'DRAW_CREATED')).toHaveLength(14);
    for (const event of adminEvents.filter((item) => item.type === 'DRAW_CREATED')) {
      expect(event.eventId).toBe(event.id);
      expect(event.roundId).toBe(round.id);
      expect(allDraws.some((draw) => draw.keyValue === event.payload.key && draw.questionText === event.payload.question)).toBe(true);
    }
    expect(adminEvents.filter((event) => event.type === 'WINNER_VERIFIED')).toHaveLength(5);
    expect(adminEvents.filter((event) => event.type === 'ROUND_COMPLETED')).toHaveLength(1);
    expect(providerMessages).toHaveLength(5);
    expect(serverOutput).not.toContain(bootstrapSecret);
    expect(serverOutput).not.toContain(superPassword);
    reconnected.close();
    adminWs.close();
  }, 120000);
});
