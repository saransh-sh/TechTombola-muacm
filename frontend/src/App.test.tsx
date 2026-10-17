import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { waitFor } from '@testing-library/react';
import { App } from './App';
import { queryClient } from './lib/queryClient';
import { ApiError } from './lib/api/client';
import * as authApi from './lib/api/auth';
import * as participantApi from './lib/api/participant';
import * as ticketApi from './lib/api/ticket';

vi.mock('./lib/api/auth', () => ({ getMe: vi.fn(), login: vi.fn(), logout: vi.fn() }));
vi.mock('./lib/api/participant', () => ({ getParticipantEvent: vi.fn(), getCurrentRound: vi.fn() }));
vi.mock('./lib/api/ticket', () => ({ getParticipantTicket: vi.fn() }));

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

  it('renders the exact ticket cells and marked flags on the ticket and game routes', async () => {
    vi.mocked(authApi.getMe).mockResolvedValue({ id: 'u1', email: 'p@example.test', name: 'Ari Patel', role: 'PARTICIPANT', status: 'ACTIVE' });
    vi.mocked(participantApi.getParticipantEvent).mockResolvedValue({ id: 'e1', title: 'Autumn', description: null, status: 'LIVE', scheduledAt: null, startedAt: null, completedAt: null, createdAt: '2026-10-16T00:00:00.000Z', updatedAt: '2026-10-17T00:00:00.000Z' });
    vi.mocked(participantApi.getCurrentRound).mockResolvedValue({ id: 'r1', eventId: 'e1', sequenceNumber: 1, name: 'Opening', status: 'ACTIVE', patterns: [], createdAt: '2026-10-17T00:00:00.000Z', updatedAt: '2026-10-17T00:00:00.000Z' });
    const cells = Array.from({ length: 15 }, (_, index) => ({ id: `cell-${index}`, rowIndex: Math.floor(index / 5), colIndex: index % 5, row: Math.floor(index / 5), column: index % 5, keyId: `key-${index}`, keyValue: index === 0 ? 'A VERY LONG KEY VALUE' : `KEY ${index}`, marked: index === 0 }));
    vi.mocked(ticketApi.getParticipantTicket).mockResolvedValue({ id: 'ticket-7', roundId: 'r1', participantId: 'p1', eventId: 'e1', createdAt: '2026-10-17T00:00:00.000Z', cells });
    window.history.replaceState({}, '', '/participant/ticket');
    render(<App />);
    expect(await screen.findByRole('table', { name: 'Your Tombola ticket' })).toBeInTheDocument();
    expect(screen.getByText('A VERY LONG KEY VALUE')).toBeInTheDocument();
    expect(screen.getByText('Marked')).toBeInTheDocument();
    expect(screen.getAllByText('Not marked')).toHaveLength(14);
    expect(screen.getByText('ticket-7')).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Row 1, column 1: A VERY LONG KEY VALUE, marked' })).toHaveAttribute('data-cell-id', 'cell-0');
    expect(queryClient.getQueryData(['participant', 'u1', 'ticket', 'e1', 'r1'])).toMatchObject({ id: 'ticket-7' });
    expect(ticketApi.getParticipantTicket).toHaveBeenCalledWith('r1', 'e1', expect.any(AbortSignal));
  });

  it('shows the honest waiting state when the backend has not allocated a ticket', async () => {
    vi.mocked(authApi.getMe).mockResolvedValue({ id: 'u1', email: 'p@example.test', name: 'Ari Patel', role: 'PARTICIPANT', status: 'ACTIVE' });
    vi.mocked(participantApi.getParticipantEvent).mockResolvedValue({ id: 'e1', title: 'Autumn', description: null, status: 'LIVE', scheduledAt: null, startedAt: null, completedAt: null, createdAt: '2026-10-16T00:00:00.000Z', updatedAt: '2026-10-17T00:00:00.000Z' });
    vi.mocked(participantApi.getCurrentRound).mockResolvedValue({ id: 'r1', eventId: 'e1', sequenceNumber: 1, name: 'Opening', status: 'READY', patterns: [], createdAt: '2026-10-17T00:00:00.000Z', updatedAt: '2026-10-17T00:00:00.000Z' });
    vi.mocked(ticketApi.getParticipantTicket).mockRejectedValue(new ApiError(404, 'Ticket not found'));
    window.history.replaceState({}, '', '/participant/game');
    render(<App />);
    expect(await screen.findByText('Your ticket is being prepared')).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'Your Tombola ticket' })).not.toBeInTheDocument();
  });

  it('announces ticket loading while the server response is pending', async () => {
    vi.mocked(authApi.getMe).mockResolvedValue({ id: 'u1', email: 'p@example.test', name: 'Ari Patel', role: 'PARTICIPANT', status: 'ACTIVE' });
    vi.mocked(participantApi.getParticipantEvent).mockResolvedValue({ id: 'e1', title: 'Autumn', description: null, status: 'LIVE', scheduledAt: null, startedAt: null, completedAt: null, createdAt: '2026-10-16T00:00:00.000Z', updatedAt: '2026-10-17T00:00:00.000Z' });
    vi.mocked(participantApi.getCurrentRound).mockResolvedValue({ id: 'r1', eventId: 'e1', sequenceNumber: 1, name: 'Opening', status: 'ACTIVE', patterns: [], createdAt: '2026-10-17T00:00:00.000Z', updatedAt: '2026-10-17T00:00:00.000Z' });
    let rejectTicket!: (error: Error) => void;
    vi.mocked(ticketApi.getParticipantTicket).mockReturnValue(new Promise((_, reject) => { rejectTicket = reject; }));
    window.history.replaceState({}, '', '/participant/ticket');
    render(<App />);
    expect(await screen.findByText('Loading your ticket…')).toBeInTheDocument();
    rejectTicket(new Error('Integration cleanup'));
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not load your ticket data.');
  });

  it('shows a safe permission message when the backend forbids ticket access', async () => {
    vi.mocked(authApi.getMe).mockResolvedValue({ id: 'u1', email: 'p@example.test', name: 'Ari Patel', role: 'PARTICIPANT', status: 'ACTIVE' });
    vi.mocked(participantApi.getParticipantEvent).mockResolvedValue({ id: 'e1', title: 'Autumn', description: null, status: 'LIVE', scheduledAt: null, startedAt: null, completedAt: null, createdAt: '2026-10-16T00:00:00.000Z', updatedAt: '2026-10-17T00:00:00.000Z' });
    vi.mocked(participantApi.getCurrentRound).mockResolvedValue({ id: 'r1', eventId: 'e1', sequenceNumber: 1, name: 'Opening', status: 'ACTIVE', patterns: [], createdAt: '2026-10-17T00:00:00.000Z', updatedAt: '2026-10-17T00:00:00.000Z' });
    vi.mocked(ticketApi.getParticipantTicket).mockRejectedValue(new ApiError(403, 'private backend details'));
    window.history.replaceState({}, '', '/participant/ticket');
    render(<App />);
    expect(await screen.findByRole('alert')).toHaveTextContent('You do not have permission to view this ticket.');
    expect(screen.queryByText('private backend details')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });

  it('shows a visible generic error when ticket data cannot be loaded', async () => {
    vi.mocked(authApi.getMe).mockResolvedValue({ id: 'u1', email: 'p@example.test', name: 'Ari Patel', role: 'PARTICIPANT', status: 'ACTIVE' });
    vi.mocked(participantApi.getParticipantEvent).mockResolvedValue({ id: 'e1', title: 'Autumn', description: null, status: 'LIVE', scheduledAt: null, startedAt: null, completedAt: null, createdAt: '2026-10-16T00:00:00.000Z', updatedAt: '2026-10-17T00:00:00.000Z' });
    vi.mocked(participantApi.getCurrentRound).mockResolvedValue({ id: 'r1', eventId: 'e1', sequenceNumber: 1, name: 'Opening', status: 'ACTIVE', patterns: [], createdAt: '2026-10-17T00:00:00.000Z', updatedAt: '2026-10-17T00:00:00.000Z' });
    vi.mocked(ticketApi.getParticipantTicket).mockRejectedValue(new Error('Malformed ticket DTO'));
    window.history.replaceState({}, '', '/participant/ticket');
    render(<App />);
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not load your ticket data. Check your connection and try again.');
    expect(screen.queryByRole('table', { name: 'Your Tombola ticket' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('does not read a previous participant ticket from the cache after identity changes', async () => {
    const cells = Array.from({ length: 15 }, (_, index) => ({ id: `new-cell-${index}`, rowIndex: Math.floor(index / 5), colIndex: index % 5, row: Math.floor(index / 5), column: index % 5, keyId: `new-key-${index}`, keyValue: `KEY ${index}`, marked: false }));
    queryClient.setQueryData(['participant', 'u1', 'ticket', 'e1', 'r1'], { id: 'old-participant-ticket', roundId: 'r1', participantId: 'old-profile', eventId: 'e1', createdAt: '2026-10-17T00:00:00.000Z', cells });
    vi.mocked(authApi.getMe).mockResolvedValue({ id: 'u2', email: 'other@example.test', name: 'Sam Lee', role: 'PARTICIPANT', status: 'ACTIVE' });
    vi.mocked(participantApi.getParticipantEvent).mockResolvedValue({ id: 'e1', title: 'Autumn', description: null, status: 'LIVE', scheduledAt: null, startedAt: null, completedAt: null, createdAt: '2026-10-16T00:00:00.000Z', updatedAt: '2026-10-17T00:00:00.000Z' });
    vi.mocked(participantApi.getCurrentRound).mockResolvedValue({ id: 'r1', eventId: 'e1', sequenceNumber: 1, name: 'Opening', status: 'ACTIVE', patterns: [], createdAt: '2026-10-17T00:00:00.000Z', updatedAt: '2026-10-17T00:00:00.000Z' });
    vi.mocked(ticketApi.getParticipantTicket).mockResolvedValue({ id: 'new-participant-ticket', roundId: 'r1', participantId: 'new-profile', eventId: 'e1', createdAt: '2026-10-17T00:00:00.000Z', cells });
    window.history.replaceState({}, '', '/participant/ticket');
    render(<App />);
    expect(await screen.findByText('new-participant-ticket')).toBeInTheDocument();
    expect(screen.queryByText('old-participant-ticket')).not.toBeInTheDocument();
    expect(ticketApi.getParticipantTicket).toHaveBeenCalledOnce();
  });
});
