import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAdminRoundRealtime } from './useAdminRoundRealtime';

class TestWebSocket {
  static instances: TestWebSocket[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  readonly close = vi.fn();

  constructor(readonly url: string) { TestWebSocket.instances.push(this); }
  disconnect(code: number) { this.onclose?.({ code } as CloseEvent); }
  receive(data: string) { this.onmessage?.({ data } as MessageEvent); }
}
const eventId = 'f5b7e894-a4fb-4d03-9a51-12dde82059da';
const roundId = 'af9b8328-2dd1-4d75-bb16-9ce6655dd15f';

describe('useAdminRoundRealtime', () => {
  beforeEach(() => {
    TestWebSocket.instances = [];
    vi.stubGlobal('WebSocket', TestWebSocket);
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });

  function subscribe() {
    const onOpen = vi.fn();
    const onDrawCreated = vi.fn();
    const onRoundChanged = vi.fn();
    const hook = renderHook(() => useAdminRoundRealtime({
      eventId, roundId, status: 'ACTIVE', onOpen, onDrawCreated, onRoundChanged,
    }));
    return { ...hook, onOpen, onDrawCreated, onRoundChanged };
  }

  it('reconnects with exponential delays capped at 30 seconds and refreshes on open', () => {
    vi.useFakeTimers();
    const { result, onOpen } = subscribe();
    expect(result.current).toBe('connecting');
    const first = TestWebSocket.instances[0]!;
    expect(first.url).toContain(`/api/v1/ws?eventId=${eventId}&roundId=${roundId}`);
    for (const [index, delay] of [1_000, 2_000, 4_000, 8_000, 16_000, 30_000].entries()) {
      act(() => { TestWebSocket.instances.at(-1)!.disconnect(1006); });
      expect(result.current).toBe('reconnecting');
      act(() => { vi.advanceTimersByTime(delay - 1); });
      expect(TestWebSocket.instances).toHaveLength(index + 1);
      act(() => { vi.advanceTimersByTime(1); });
      expect(TestWebSocket.instances).toHaveLength(index + 2);
    }
    act(() => { TestWebSocket.instances.at(-1)!.onopen?.(); });
    expect(result.current).toBe('connected');
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it('does not retry a subscription rejected with close code 1008', () => {
    vi.useFakeTimers();
    const { result } = subscribe();
    act(() => TestWebSocket.instances[0]!.disconnect(1008));
    expect(result.current).toBe('unavailable');
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(TestWebSocket.instances).toHaveLength(1);
  });

  it('marks a failed WebSocket construction unavailable', () => {
    vi.stubGlobal('WebSocket', class { constructor() { throw new Error('blocked'); } });
    const { result } = subscribe();
    expect(result.current).toBe('unavailable');
  });

  it('ignores malformed, invalid, and out-of-scope messages', () => {
    const { onDrawCreated, onRoundChanged } = subscribe();
    const socket = TestWebSocket.instances[0]!;
    socket.receive('not-json');
    socket.receive('{}');
    socket.receive(JSON.stringify({ type: 'ROUND_PAUSED', eventId: '71b0a84c-8c96-486d-acb0-f6bad4c0f68a', roundId, occurredAt: '2026-10-17T10:00:00.000Z', payload: { status: 'PAUSED' } }));
    expect(onDrawCreated).not.toHaveBeenCalled();
    expect(onRoundChanged).not.toHaveBeenCalled();
    socket.receive(JSON.stringify({ type: 'DRAW_CREATED', eventId, roundId, occurredAt: '2026-10-17T10:00:00.000Z', payload: { sequence: 2, key: 'DOCKER', question: 'Which tool?', drawnAt: '2026-10-17T10:00:00.000Z' } }));
    expect(onDrawCreated).toHaveBeenCalledOnce();
    expect(onRoundChanged).not.toHaveBeenCalled();
  });
});
