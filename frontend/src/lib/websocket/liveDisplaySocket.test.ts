import { afterEach, describe, expect, it, vi } from 'vitest';
import { liveDisplaySocketUrl } from './liveDisplaySocket';

describe('liveDisplaySocketUrl', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('uses the public Live Display route with explicit Event and Round scope', () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://tombola.example.test');
    const url = new URL(liveDisplaySocketUrl('event-1', 'round-1'));
    expect(url.protocol).toBe('wss:');
    expect(url.pathname).toBe('/api/v1/live/ws');
    expect(url.searchParams.get('eventId')).toBe('event-1');
    expect(url.searchParams.get('roundId')).toBe('round-1');
  });
});
