import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { QueryClient } from '@tanstack/react-query';
import { participantSocketUrl, useParticipantRealtime } from './realtime';

const ids = { event: '22222222-2222-4222-8222-222222222222', round: '33333333-3333-4333-8333-333333333333', other: '44444444-4444-4444-8444-444444444444' };
const drawnAt = '2026-10-17T14:00:00.000Z';

class FakeWebSocket {
  static OPEN = 1;
  static instances: FakeWebSocket[] = [];
  readyState = 0;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  constructor(readonly url: string) { FakeWebSocket.instances.push(this); }
  open() { this.readyState = FakeWebSocket.OPEN; this.onopen?.(); }
  message(data: unknown) { this.onmessage?.({ data: typeof data === 'string' ? data : JSON.stringify(data) }); }
  close() { this.readyState = 3; this.onclose?.(); }
}

function drawEvent(sequence: number, scope = ids.round) {
  return { type: 'DRAW_CREATED', eventId: ids.event, roundId: scope, occurredAt: drawnAt, payload: { sequence, key: `KEY ${sequence}`, question: `Question ${sequence}`, drawnAt } };
}

describe('participant realtime connection', () => {
  const queryClient = { invalidateQueries: vi.fn().mockResolvedValue(undefined), cancelQueries: vi.fn().mockResolvedValue(undefined), refetchQueries: vi.fn().mockResolvedValue(undefined) } as unknown as QueryClient;
  beforeEach(() => {
    FakeWebSocket.instances = [];
    vi.stubGlobal('WebSocket', FakeWebSocket as unknown as typeof WebSocket);
    queryClient.invalidateQueries = vi.fn().mockResolvedValue(undefined);
    queryClient.cancelQueries = vi.fn().mockResolvedValue(undefined);
    queryClient.refetchQueries = vi.fn().mockResolvedValue(undefined);
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

  it('uses the same-origin authenticated subscription URL', () => {
    const url = new URL(participantSocketUrl(ids.round));
    expect(url.protocol).toBe('ws:');
    expect(url.pathname).toBe('/api/v1/ws');
    expect(url.searchParams.get('roundId')).toBe(ids.round);
  });

  it('reconciles after subscription and keeps unique in-scope Draws in sequence order', async () => {
    const { result } = renderHook(() => useParticipantRealtime(true, 'user-1', ids.event, ids.round, queryClient));
    const socket = FakeWebSocket.instances[0]!;
    expect(result.current.status).toBe('CONNECTING');
    await act(async () => { socket.open(); await Promise.resolve(); });
    expect(result.current.status).toBe('CONNECTED');
    expect(queryClient.cancelQueries).toHaveBeenCalledWith({ queryKey: ['participant', 'user-1', 'draws', ids.event, ids.round], exact: true });
    expect(queryClient.refetchQueries).toHaveBeenCalledWith({ queryKey: ['participant', 'user-1', 'draws', ids.event, ids.round], exact: true, type: 'active' });

    act(() => { socket.message(drawEvent(3)); socket.message(drawEvent(3)); socket.message(drawEvent(1)); socket.message(drawEvent(2, ids.other)); });
    expect(result.current.liveDraws.map((draw) => draw.sequenceNumber)).toEqual([1, 3]);
    expect(result.current.liveDraws.at(-1)?.keyValue).toBe('KEY 3');
  });

  it('flags malformed or unknown messages and reconciles from REST', async () => {
    const { result } = renderHook(() => useParticipantRealtime(true, 'user-1', ids.event, ids.round, queryClient));
    const socket = FakeWebSocket.instances[0]!;
    await act(async () => { socket.open(); await Promise.resolve(); });
    act(() => socket.message({ type: 'FUTURE_EVENT' }));
    expect(result.current.warning).toMatch(/could not be read/i);
    expect(queryClient.refetchQueries).toHaveBeenCalledWith({ queryKey: ['participant', 'user-1', 'draws', ids.event, ids.round], exact: true, type: 'active' });
  });

  it('invalidates round and draw snapshots for lifecycle events', async () => {
    renderHook(() => useParticipantRealtime(true, 'user-1', ids.event, ids.round, queryClient));
    const socket = FakeWebSocket.instances[0]!;
    await act(async () => { socket.open(); await Promise.resolve(); });
    act(() => socket.message({ type: 'ROUND_PAUSED', eventId: ids.event, roundId: ids.round, occurredAt: drawnAt, payload: { status: 'PAUSED' } }));
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['participant', 'user-1', 'round', ids.event] });
  });

  it('backs off reconnect attempts, stops after the retry limit, and lets the user retry', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useParticipantRealtime(true, 'user-1', ids.event, ids.round, queryClient));
    act(() => FakeWebSocket.instances[0]!.close());
    expect(result.current.status).toBe('RECONNECTING');
    await act(async () => { vi.advanceTimersByTime(500); });
    expect(FakeWebSocket.instances).toHaveLength(2);
    for (const delay of [1000, 2000, 4000, 8000]) {
      act(() => FakeWebSocket.instances.at(-1)!.close());
      await act(async () => { vi.advanceTimersByTime(delay); });
    }
    act(() => FakeWebSocket.instances.at(-1)!.close());
    expect(result.current.status).toBe('DISCONNECTED');
    act(() => result.current.retry());
    expect(FakeWebSocket.instances).toHaveLength(7);
  });

  it('closes the old scope and ignores its late event after a round switch', async () => {
    const { result, rerender } = renderHook(({ roundId }) => useParticipantRealtime(true, 'user-1', ids.event, roundId, queryClient), { initialProps: { roundId: ids.round } });
    const oldSocket = FakeWebSocket.instances[0]!;
    rerender({ roundId: ids.other });
    expect(oldSocket.readyState).toBe(3);
    act(() => oldSocket.message(drawEvent(8)));
    expect(result.current.liveDraws).toEqual([]);
    expect(FakeWebSocket.instances).toHaveLength(2);
  });
});
