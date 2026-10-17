import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function mockAuthentication(page: Page, role?: 'PARTICIPANT' | 'ADMIN' | 'SUPER_ADMIN', authenticated = false, initialRoundStatus: 'DRAFT' | 'ACTIVE' = 'DRAFT') {
  let user: null | { id: string; email: string; name: string; role: string; status: string } = role && authenticated
    ? { id: 'user-1', email: 'attendee@example.test', name: 'Ari Patel', role, status: 'ACTIVE' }
    : null;
  await page.route('**/api/v1/me', (route) => route.fulfill({
    status: user ? 200 : 401,
    contentType: 'application/json',
    body: JSON.stringify(user ? { user } : { error: { code: 'UNAUTHORIZED', message: 'Authentication required' }, requestId: 'test' }),
  }));
  await page.route('**/api/v1/auth/login', async (route) => {
    const loginUser = { id: 'user-1', email: 'attendee@example.test', name: 'Ari Patel', role: role ?? 'PARTICIPANT' };
    user = { ...loginUser, status: 'ACTIVE' };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: loginUser }) });
  });
  await page.route('**/api/v1/auth/logout', async (route) => {
    user = null;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'Successfully logged out' }) });
  });
  await page.route('**/api/v1/admin/dashboard', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      event: { id: 'event-1', title: 'Tech Tombola 2026', status: 'LIVE' },
      round: { id: 'round-1', name: 'Round 1', sequenceNumber: 1, status: 'ACTIVE' },
      participants: 500, connectedConnections: 431, drawCount: 12, pendingClaims: 2,
      verifiedWinners: 4, recoveryRequired: false, systemStatus: 'operational',
    }),
  }));
  const event = {
    id: '0d3aa3e6-4c58-4c36-b363-d5f11640ba52', title: 'Tech Tombola 2026', description: 'Annual event', status: 'READY',
    scheduledAt: null, startedAt: null, completedAt: null,
    createdAt: '2026-10-17T10:00:00.000Z', updatedAt: '2026-10-17T10:00:00.000Z',
  };
  await page.route('**/api/v1/admin/events?*', (route) => route.fulfill({
    status: route.request().method() === 'POST' ? 201 : 200,
    contentType: 'application/json',
    body: JSON.stringify(route.request().method() === 'POST'
      ? { event: { ...event, title: route.request().postDataJSON().title, status: 'DRAFT' } }
      : { data: [event], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } }),
  }));
  await page.route('**/api/v1/admin/events/*', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ event: route.request().method() === 'PATCH' ? { ...event, ...route.request().postDataJSON() } : event }),
  }));
  const participant = {
    id: '4d9ec244-a97a-4c8c-a657-1e7fd5b9be69', userId: '8d632d5f-16b1-4292-99e5-0d3628914c2c', eventId: event.id,
    email: 'sam@example.test', name: 'Sam Rivera', externalId: 'E-42', status: 'ACTIVE', emailDeliveryStatus: 'SENT',
    createdAt: event.createdAt, updatedAt: event.updatedAt,
  };
  await page.route('**/api/v1/admin/participants?*', async (route) => {
    const url = new URL(route.request().url());
    const body = route.request().method() === 'POST' ? { participant: { ...participant, ...route.request().postDataJSON() } } : {
      data: url.searchParams.get('search') && !'Sam Rivera sam@example.test E-42'.toLowerCase().includes(url.searchParams.get('search')!.toLowerCase()) ? [] : [participant],
      pagination: { page: Number(url.searchParams.get('page') ?? 1), limit: 20, total: 1, totalPages: 1 },
    };
    await route.fulfill({ status: route.request().method() === 'POST' ? 201 : 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.route('**/api/v1/admin/participants/*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ participant: route.request().method() === 'PATCH' ? { ...participant, ...route.request().postDataJSON() } : participant }) });
  });
  const round = {
    id: '5c15e548-2bf0-4b12-8e8b-7d2c7cd91872', eventId: event.id, sequenceNumber: 1, name: 'Opening round', status: 'DRAFT',
    patterns: ['EARLY_5', 'TOP_LINE', 'MIDDLE_LINE', 'BOTTOM_LINE', 'FULL_HOUSE'].map((patternType, index) => ({
      id: `a4a85404-a3d6-4da6-9b21-ccfc6a11e71${index}`, roundId: '5c15e548-2bf0-4b12-8e8b-7d2c7cd91872', patternType,
      enabled: true, maxWinners: 1, status: 'OPEN', createdAt: event.createdAt, updatedAt: event.updatedAt,
    })), createdAt: event.createdAt, updatedAt: event.updatedAt,
  };
  let currentRound = { ...round, status: initialRoundStatus };
  await page.route('**/api/v1/admin/rounds?*', (route) => route.fulfill({
    status: route.request().method() === 'POST' ? 201 : 200,
    contentType: 'application/json',
    body: JSON.stringify(route.request().method() === 'POST' ? { round: { ...currentRound, ...route.request().postDataJSON() } } : { data: [currentRound], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } }),
  }));
  await page.route('**/api/v1/admin/rounds/*', async (route) => {
    if (route.request().method() === 'PATCH') currentRound = { ...currentRound, ...route.request().postDataJSON() };
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ round: currentRound }) });
  });
  await page.route(/\/api\/v1\/admin\/rounds\/[^/]+\/tickets\/generate$/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ roundId: currentRound.id, totalParticipants: 500, created: 500, existing: 0, skipped: 0 }) }));
  await page.route(/\/api\/v1\/admin\/rounds\/[^/]+\/tickets\?/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [], total: 0 }) }));
  await page.route(/\/api\/v1\/admin\/rounds\/[^/]+\/(ready|start|pause|resume|complete|cancel)$/, async (route) => {
    const command = new URL(route.request().url()).pathname.split('/').at(-1)!;
    currentRound = { ...currentRound, status: ({ ready: 'READY', start: 'ACTIVE', pause: 'PAUSED', resume: 'ACTIVE', complete: 'COMPLETED', cancel: 'CANCELLED' } as const)[command as 'ready' | 'start' | 'pause' | 'resume' | 'complete' | 'cancel'] };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ round: currentRound }) });
  });
  const key = { id: '7c5e95cf-9a31-4a3c-83cc-a353ccde9fd1', eventId: event.id, value: 'DOCKER', normalizedValue: 'DOCKER', createdAt: event.createdAt, updatedAt: event.updatedAt };
  const question = { id: 'a4a85404-a3d6-4da6-9b21-ccfc6a11e713', roundId: round.id, keyId: key.id, keyValue: key.value, questionText: 'What runs containers?', createdAt: event.createdAt, updatedAt: event.updatedAt };
  await page.route('**/api/v1/admin/keys?*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [key], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } }) }));
  await page.route('**/api/v1/admin/questions?*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [question], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } }) }));
  await page.route('**/api/v1/admin/participants/import', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ totalReceived: 1, createdCount: 1, skippedCount: 0, failedCount: 0, errors: [] }) });
  });
}

test('login screen exposes labelled credentials and accessible validation', async ({ page }) => {
  await mockAuthentication(page);
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: /find your winning line/i })).toBeVisible();
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByRole('alert')).toContainText('valid email');
});

test('login screen fits a narrow mobile viewport without horizontal overflow', async ({ page }) => {
  await mockAuthentication(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/login');
  await expect(page.getByLabel('Email address')).toBeVisible();
  await expect(page.getByLabel('Password')).toBeVisible();
  expect(await page.locator('body').evaluate((element) => element.scrollWidth <= window.innerWidth)).toBe(true);
});

test('successful participant login opens the participant route', async ({ page }) => {
  await mockAuthentication(page);
  await page.goto('/login');
  await page.getByLabel('Email address').fill('attendee@example.test');
  await page.getByLabel('Password').fill('password');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/participant$/);
  await expect(page.getByText('Your event ticket is ready.')).toBeVisible();
});

test('admin and super admin accounts share the role-gated admin application', async ({ page }) => {
  await mockAuthentication(page, 'SUPER_ADMIN');
  await page.goto('/login');
  await page.getByLabel('Email address').fill('attendee@example.test');
  await page.getByLabel('Password').fill('password');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole('heading', { name: 'Operations dashboard' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'System' })).toBeVisible();
});

test('an admin login opens the shared admin application', async ({ page }) => {
  await mockAuthentication(page, 'ADMIN');
  await page.goto('/login');
  await page.getByLabel('Email address').fill('attendee@example.test');
  await page.getByLabel('Password').fill('password');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole('heading', { name: 'Operations dashboard' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'System' })).toHaveCount(0);
});

test('admin dashboard shows operational metrics and keyboard navigation at tablet width', async ({ page }) => {
  await mockAuthentication(page, 'ADMIN', true);
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto('/admin');
  await expect(page.getByText('Tech Tombola 2026')).toBeVisible();
  await expect(page.getByText('431', { exact: true })).toBeVisible();
  await expect(page.getByText('12', { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: 'design/screenshots/admin-dashboard-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.screenshot({ path: 'design/screenshots/admin-dashboard-tablet.png', fullPage: true });
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Dashboard' })).toBeFocused();
  await page.getByRole('link', { name: 'Event' }).click();
  await expect(page).toHaveURL(/\/admin\/event$/);
  await expect(page.getByRole('heading', { name: 'Event management' })).toBeVisible();
  await page.getByRole('button', { name: /Tech Tombola 2026/ }).click();
  await expect(page.getByText('Annual event')).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: 'design/screenshots/admin-event-management-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByRole('link', { name: 'Rounds' }).click();
  await expect(page).toHaveURL(/\/admin\/rounds\?eventId=/);
  await expect(page.getByRole('heading', { name: 'Round configuration' })).toBeVisible();
  await expect(page.getByText('Opening round')).toBeVisible();
  await page.getByRole('button', { name: /Opening round/ }).click();
  await expect(page.getByText(/EARLY 5/)).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: 'design/screenshots/admin-round-configuration-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Create Round' }).click();
  await page.getByRole('button', { name: 'Save Round' }).click();
  await expect(page.getByLabel('Round name')).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByRole('link', { name: 'Questions & Keys' }).click();
  await expect(page).toHaveURL(/\/admin\/questions\?eventId=/);
  await expect(page.getByRole('heading', { name: 'Questions & Keys' })).toBeVisible();
  await expect(page.getByText('What runs containers?')).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: 'design/screenshots/admin-question-key-management-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('Round operations show server allocation and confirm the authoritative ready/start flow on desktop and mobile', async ({ page }) => {
  await mockAuthentication(page, 'ADMIN', true);
  const eventId = '0d3aa3e6-4c58-4c36-b363-d5f11640ba52';
  const roundId = '5c15e548-2bf0-4b12-8e8b-7d2c7cd91872';
  page.on('dialog', (dialog) => dialog.accept());
  await page.goto(`/admin/rounds?eventId=${eventId}&roundId=${roundId}`);
  await expect(page.getByRole('heading', { name: 'Round operations' })).toBeVisible();
  await expect(page.getByText('Tickets reported by server')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Generate Tickets' })).toBeEnabled();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: 'design/screenshots/admin-round-operations-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: 'Mark ready' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'design/screenshots/admin-round-operations-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Mark ready' }).click();
  await expect(page.getByRole('button', { name: 'Start Round' })).toBeVisible();
  await page.getByRole('button', { name: 'Start Round' }).click();
  await expect(page.getByText('Start Round confirmed by the server.')).toBeVisible();
  await expect(page.getByText('Status: ACTIVE')).toBeVisible();
});

test('Draw control confirms random and manual draws and reconciles persisted history on desktop and mobile', async ({ page }) => {
  await mockAuthentication(page, 'ADMIN', true, 'ACTIVE');
  const eventId = '0d3aa3e6-4c58-4c36-b363-d5f11640ba52';
  const roundId = '5c15e548-2bf0-4b12-8e8b-7d2c7cd91872';
  const questionId = 'a4a85404-a3d6-4da6-9b21-ccfc6a11e713';
  const keyId = '7c5e95cf-9a31-4a3c-83cc-a353ccde9fd1';
  const savedDraws = [{
    id: '229f4f40-cff3-48a5-b177-8fbd55c1ed3b', roundId, sequenceNumber: 1, drawMode: 'RANDOM', questionId, keyId,
    questionText: 'What runs containers?', keyValue: 'DOCKER', drawnAt: '2026-10-17T10:00:00.000Z',
  }];
  page.on('dialog', (dialog) => dialog.accept());
  await page.routeWebSocket('**/api/v1/ws?*', (socket) => {
    socket.send(JSON.stringify({ type: 'DRAW_CREATED', eventId, roundId, occurredAt: '2026-10-17T10:00:00.000Z', payload: { sequence: 1, key: 'DOCKER', question: 'What runs containers?', drawnAt: '2026-10-17T10:00:00.000Z' } }));
  });
  await page.route(/\/api\/v1\/admin\/rounds\/[^/]+\/draws(?:\/manual)?(?:\?.*)?$/, async (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() === 'GET') {
      const pageNumber = Number(url.searchParams.get('page') ?? 1);
      const limit = Number(url.searchParams.get('limit') ?? 20);
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: savedDraws, total: savedDraws.length, page: pageNumber, limit }) });
    }
    const manual = url.pathname.endsWith('/manual');
    const selectedQuestionId = manual ? route.request().postDataJSON().questionId : questionId;
    const next = { ...savedDraws[0]!, id: crypto.randomUUID(), sequenceNumber: savedDraws.length + 1, drawMode: manual ? 'MANUAL' : 'RANDOM', questionId: selectedQuestionId };
    savedDraws.push(next);
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ draw: next }) });
  });
  await page.goto(`/admin/draw-control?eventId=${eventId}&roundId=${roundId}`);
  await expect(page.getByRole('heading', { name: 'Draw control' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Current Draw' })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'WebSocket connected' })).toBeVisible();
  await expect(page.getByText('DOCKER').first()).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: 'design/screenshots/admin-draw-control-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Draw random Question' }).click();
  await expect(page.getByText('RANDOM Draw 2 confirmed by the server.')).toBeVisible();
  await expect(page.getByText('DRAW 2').first()).toBeVisible();
  await page.getByLabel('Manual Question').selectOption(questionId);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'design/screenshots/admin-draw-control-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Create manual Draw' }).click();
  await expect(page.getByText('MANUAL Draw 3 confirmed by the server.')).toBeVisible();
  await expect(page.getByText('DRAW 3').first()).toBeVisible();
  expect(savedDraws).toHaveLength(3);
});

test('participant management scopes and searches safely on mobile', async ({ page }) => {
  await mockAuthentication(page, 'ADMIN', true);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/admin/participants?eventId=0d3aa3e6-4c58-4c36-b363-d5f11640ba52');
  await expect(page.getByRole('heading', { name: 'Participant management' })).toBeVisible();
  await expect(page.getByText('Sam Rivera')).toBeVisible();
  await expect(page.getByText(/G03 is unresolved/)).toBeVisible();
  await page.getByLabel('Search by name, email or external ID').fill('missing');
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(page.getByText('No Participants match this Event and filter.')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('admin previews and explicitly confirms a Participant CSV import', async ({ page }) => {
  await mockAuthentication(page, 'ADMIN', true);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/admin/participants?eventId=0d3aa3e6-4c58-4c36-b363-d5f11640ba52');
  await page.getByLabel('CSV file').setInputFiles({ name: 'players.csv', mimeType: 'text/csv', buffer: Buffer.from('name,email\nNora,nora@example.test') });
  await expect(page.getByRole('table', { name: 'CSV preview' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirm import of 1 rows' })).toBeEnabled();
  await page.getByRole('button', { name: 'Confirm import of 1 rows' }).click();
  await expect(page.getByRole('heading', { name: 'Import results' })).toBeVisible();
  await expect(page.getByText('Created', { exact: true })).toBeVisible();
  await expect(page.getByText(/does not include per-Participant credential-delivery status/)).toBeVisible();
  await page.screenshot({ path: 'design/screenshots/admin-participant-csv-import-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('an expired session returns to login without showing protected content', async ({ page }) => {
  await mockAuthentication(page);
  await page.goto('/admin/rounds');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: /find your winning line/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Operations dashboard' })).toHaveCount(0);
});

test('a participant cannot enter an admin route', async ({ page }) => {
  await mockAuthentication(page, 'PARTICIPANT', true);
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/participant$/);
  await expect(page.getByText('Your event ticket is ready.')).toBeVisible();
});

test('login restores the complete protected path, including query and fragment', async ({ page }) => {
  await mockAuthentication(page, 'ADMIN');
  await page.goto('/admin/rounds?status=READY#schedule');
  await page.getByLabel('Email address').fill('attendee@example.test');
  await page.getByLabel('Password').fill('password');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/admin\/rounds\?status=READY#schedule$/);
});

test('logout failure is visible and keeps the current authenticated screen', async ({ page }) => {
  await mockAuthentication(page, 'ADMIN', true);
  await page.route('**/api/v1/auth/logout', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { code: 'SERVICE_UNAVAILABLE', message: 'Unavailable' } }) }));
  await page.goto('/admin');
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('alert')).toContainText('could not end your session');
  await expect(page).toHaveURL(/\/admin$/);
});
