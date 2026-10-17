import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from './client';
import { createAdminRound, getAdminRound, listAdminRounds, updateAdminRound } from './adminRounds';

vi.mock('./client', () => ({ apiRequest: vi.fn() }));
const eventId = '91c16f5c-7285-4fc2-9954-7043a0d6e5b4';
const roundId = '0d3aa3e6-4c58-4c36-b363-d5f11640ba52';
const round = { id: roundId, eventId, sequenceNumber: 1, name: 'Opening round', status: 'DRAFT', patterns: [], createdAt: '2026-10-17T10:00:00.000Z', updatedAt: '2026-10-17T10:00:00.000Z' };

describe('admin Round API', () => {
  afterEach(() => vi.clearAllMocks());
  it('lists Rounds within the selected Event scope and passes cancellation', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: [round], pagination: { page: 2, limit: 20, total: 21, totalPages: 2 } });
    const controller = new AbortController();
    await listAdminRounds({ eventId, page: 2, signal: controller.signal });
    expect(apiRequest).toHaveBeenCalledWith(`/admin/rounds?eventId=${eventId}&page=2&limit=20`, { signal: controller.signal });
  });
  it('uses documented detail, create, and update contracts', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ round });
    await getAdminRound(roundId);
    expect(apiRequest).toHaveBeenLastCalledWith(`/admin/rounds/${roundId}`, { signal: undefined });
    await createAdminRound({ eventId, sequenceNumber: 1, name: 'Opening round' });
    expect(apiRequest).toHaveBeenLastCalledWith('/admin/rounds', { method: 'POST', body: JSON.stringify({ eventId, sequenceNumber: 1, name: 'Opening round' }), signal: undefined });
    await updateAdminRound(roundId, { patterns: [{ patternType: 'TOP_LINE', enabled: true, maxWinners: 2 }] });
    expect(apiRequest).toHaveBeenLastCalledWith(`/admin/rounds/${roundId}`, { method: 'PATCH', body: JSON.stringify({ patterns: [{ patternType: 'TOP_LINE', enabled: true, maxWinners: 2 }] }), signal: undefined });
  });
  it('rejects malformed server records instead of trusting them', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ round: { ...round, status: 'UNKNOWN' } });
    await expect(getAdminRound(roundId)).rejects.toThrow();
  });
});
