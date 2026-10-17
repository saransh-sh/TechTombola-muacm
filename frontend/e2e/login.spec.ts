import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function mockAuthentication(page: Page, role?: 'PARTICIPANT' | 'ADMIN' | 'SUPER_ADMIN', authenticated = false) {
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
  const round = {
    id: '5c15e548-2bf0-4b12-8e8b-7d2c7cd91872', eventId: event.id, sequenceNumber: 1, name: 'Opening round', status: 'DRAFT',
    patterns: ['EARLY_5', 'TOP_LINE', 'MIDDLE_LINE', 'BOTTOM_LINE', 'FULL_HOUSE'].map((patternType, index) => ({
      id: `a4a85404-a3d6-4da6-9b21-ccfc6a11e71${index}`, roundId: '5c15e548-2bf0-4b12-8e8b-7d2c7cd91872', patternType,
      enabled: true, maxWinners: 1, status: 'OPEN', createdAt: event.createdAt, updatedAt: event.updatedAt,
    })), createdAt: event.createdAt, updatedAt: event.updatedAt,
  };
  await page.route('**/api/v1/admin/rounds?*', (route) => route.fulfill({
    status: route.request().method() === 'POST' ? 201 : 200,
    contentType: 'application/json',
    body: JSON.stringify(route.request().method() === 'POST' ? { round: { ...round, ...route.request().postDataJSON() } } : { data: [round], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } }),
  }));
  await page.route('**/api/v1/admin/rounds/*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ round }) }));
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
