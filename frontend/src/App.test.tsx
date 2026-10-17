import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { waitFor } from '@testing-library/react';
import { App } from './App';
import { queryClient } from './lib/queryClient';
import { ApiError } from './lib/api/client';
import * as authApi from './lib/api/auth';
import * as participantApi from './lib/api/participant';

vi.mock('./lib/api/auth', () => ({ getMe: vi.fn(), login: vi.fn(), logout: vi.fn() }));
vi.mock('./lib/api/participant', () => ({ getParticipantEvent: vi.fn(), getCurrentRound: vi.fn() }));

describe('application role routes', () => {
  afterEach(cleanup);
  beforeEach(() => {
    queryClient.clear();
    window.history.replaceState({}, '', '/login');
    vi.clearAllMocks();
  });

  it('restores an admin session before showing the protected surface', async () => {
    vi.mocked(authApi.getMe).mockResolvedValue({ id: 'u1', email: 'a@example.test', name: 'Ari Patel', role: 'ADMIN', status: 'ACTIVE' });
    window.history.replaceState({}, '', '/admin');
    render(<App />);
    expect(await screen.findByText('Admin access.')).toBeInTheDocument();
    expect(authApi.getMe).toHaveBeenCalledOnce();
  });

  it('redirects a participant away from an admin route', async () => {
    vi.mocked(authApi.getMe).mockResolvedValue({ id: 'u1', email: 'a@example.test', name: 'Ari Patel', role: 'PARTICIPANT', status: 'ACTIVE' });
    vi.mocked(participantApi.getParticipantEvent).mockRejectedValue(new ApiError(404, 'No event associated'));
    window.history.replaceState({}, '', '/admin');
    render(<App />);
    expect(await screen.findByText('No event assigned yet')).toBeInTheDocument();
  });

  it('sends an expired session to the login form without protected-content flash', async () => {
    vi.mocked(authApi.getMe).mockRejectedValue(new ApiError(401, 'Authentication required'));
    window.history.replaceState({}, '', '/admin/rounds');
    render(<App />);
    expect(await screen.findByRole('button', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.queryByText('Admin access.')).not.toBeInTheDocument();
    expect(authApi.getMe).toHaveBeenCalled();
  });

  it('shows a connection error instead of treating session restoration failure as logout', async () => {
    vi.mocked(authApi.getMe).mockRejectedValue(new ApiError(503, 'Unavailable'));
    render(<App />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Connection failed');
    expect(screen.queryByRole('button', { name: /sign in/i })).not.toBeInTheDocument();
  });

  it('shows a permission error for a forbidden restored session', async () => {
    vi.mocked(authApi.getMe).mockRejectedValue(new ApiError(403, 'Forbidden'));
    window.history.replaceState({}, '', '/participant');
    render(<App />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Access to this account is not permitted');
    expect(screen.queryByRole('button', { name: /sign in/i })).not.toBeInTheDocument();
  });

  it('expires the cached session when a participant endpoint returns 401', async () => {
    let requestCount = 0;
    vi.mocked(authApi.getMe).mockImplementation(async () => {
      requestCount += 1;
      if (requestCount === 1) return { id: 'u1', email: 'a@example.test', name: 'Ari Patel', role: 'PARTICIPANT', status: 'ACTIVE' };
      throw new ApiError(401, 'expired');
    });
    vi.mocked(participantApi.getParticipantEvent).mockRejectedValue(new ApiError(401, 'expired'));
    window.history.replaceState({}, '', '/participant/lobby');
    render(<App />);
    expect(await screen.findByRole('button', { name: /sign in/i })).toBeInTheDocument();
    expect(authApi.getMe).toHaveBeenCalledTimes(3);
  });

  it('expires the cached session when current-round status returns 401', async () => {
    let requestCount = 0;
    vi.mocked(authApi.getMe).mockImplementation(async () => {
      requestCount += 1;
      if (requestCount === 1) return { id: 'u1', email: 'a@example.test', name: 'Ari Patel', role: 'PARTICIPANT', status: 'ACTIVE' };
      throw new ApiError(401, 'expired');
    });
    vi.mocked(participantApi.getParticipantEvent).mockResolvedValue({ id: 'e1', title: 'Autumn', description: null, status: 'READY', scheduledAt: null, startedAt: null, completedAt: null, createdAt: '2026-10-16T00:00:00.000Z', updatedAt: '2026-10-17T00:00:00.000Z' });
    vi.mocked(participantApi.getCurrentRound).mockRejectedValue(new ApiError(401, 'expired'));
    window.history.replaceState({}, '', '/participant/lobby');
    render(<App />);
    expect(await screen.findByRole('button', { name: /sign in/i })).toBeInTheDocument();
    expect(participantApi.getCurrentRound).toHaveBeenCalledOnce();
  });

  it('shows an account-role error when the restored session has an invalid role', async () => {
    const error = new Error('Invalid user role');
    error.name = 'ZodError';
    vi.mocked(authApi.getMe).mockRejectedValue(error);
    render(<App />);
    expect(await screen.findByRole('alert')).toHaveTextContent('could not identify this account\'s role');
    expect(screen.queryByRole('button', { name: /sign in/i })).not.toBeInTheDocument();
  });

  it('clears private query data when logout succeeds', async () => {
    vi.mocked(authApi.getMe).mockResolvedValue({ id: 'u1', email: 'a@example.test', name: 'Ari Patel', role: 'ADMIN', status: 'ACTIVE' });
    vi.mocked(authApi.logout).mockResolvedValue(undefined);
    queryClient.setQueryData(['private', 'test'], 'sensitive');
    window.history.replaceState({}, '', '/admin');
    render(<App />);
    await screen.findByText('Admin access.');
    screen.getByRole('button', { name: 'Sign out' }).click();
    await waitFor(() => expect(queryClient.getQueryData(['private', 'test'])).toBeUndefined());
    expect(authApi.logout).toHaveBeenCalledOnce();
  });
});
