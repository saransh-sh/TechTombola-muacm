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
  await page.route('**/api/v1/participant/event', (route) => route.fulfill({
    status: user?.role === 'PARTICIPANT' ? 200 : 403,
    contentType: 'application/json',
    body: JSON.stringify(user?.role === 'PARTICIPANT'
      ? { event: { id: 'event-1', title: 'Autumn Tombola', description: null, status: 'READY', scheduledAt: null, startedAt: null, completedAt: null, createdAt: '2026-10-16T14:00:00.000Z', updatedAt: '2026-10-17T14:00:00.000Z' } }
      : { error: { code: 'FORBIDDEN', message: 'Participant access required' } }),
  }));
  await page.route('**/api/v1/participant/round/current', (route) => route.fulfill({
    status: 404, contentType: 'application/json', body: JSON.stringify({ error: { code: 'NOT_FOUND', message: 'No current round' } }),
  }));
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

test('successful participant login opens the participant lobby', async ({ page }) => {
  await mockAuthentication(page);
  await page.goto('/login');
  await page.getByLabel('Email address').fill('attendee@example.test');
  await page.getByLabel('Password').fill('password');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/participant\/lobby$/);
  await expect(page.getByRole('heading', { name: /welcome, ari/i })).toBeVisible();
  await expect(page.getByText('Autumn Tombola')).toBeVisible();
  await expect(page.getByText('No current round available')).toBeVisible();
});

test('admin and super admin accounts share the role-gated admin application', async ({ page }) => {
  await mockAuthentication(page, 'SUPER_ADMIN');
  await page.goto('/login');
  await page.getByLabel('Email address').fill('attendee@example.test');
  await page.getByLabel('Password').fill('password');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByText('Super Admin access.')).toBeVisible();
});

test('an admin login opens the shared admin application', async ({ page }) => {
  await mockAuthentication(page, 'ADMIN');
  await page.goto('/login');
  await page.getByLabel('Email address').fill('attendee@example.test');
  await page.getByLabel('Password').fill('password');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByText('Admin access.')).toBeVisible();
});

test('an expired session returns to login without showing protected content', async ({ page }) => {
  await mockAuthentication(page);
  await page.goto('/admin/rounds');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: /find your winning line/i })).toBeVisible();
  await expect(page.getByText('Admin access.')).toHaveCount(0);
});

test('a participant cannot enter an admin route', async ({ page }) => {
  await mockAuthentication(page, 'PARTICIPANT', true);
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/participant\/lobby$/);
  await expect(page.getByText('Autumn Tombola')).toBeVisible();
});

test('active round status opens the truthful ticket placeholder without inventing a ticket', async ({ page }) => {
  await mockAuthentication(page, 'PARTICIPANT', true);
  await page.route('**/api/v1/participant/round/current', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ round: { id: 'round-1', eventId: 'event-1', sequenceNumber: 1, name: 'Opening Round', status: 'ACTIVE', patterns: [], createdAt: '2026-10-17T14:00:00.000Z', updatedAt: '2026-10-17T14:00:00.000Z' } }) }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/participant/lobby');
  await expect(page.getByRole('link', { name: /open your ticket/i })).toBeVisible();
  await page.getByRole('link', { name: /open your ticket/i }).click();
  await expect(page.getByRole('heading', { name: /ticket is loading next/i })).toBeVisible();
  expect(await page.locator('body').evaluate((element) => element.scrollWidth <= window.innerWidth)).toBe(true);
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
