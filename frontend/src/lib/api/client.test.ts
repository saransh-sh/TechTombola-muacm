import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiRequest } from './client';

afterEach(() => vi.unstubAllGlobals());

describe('apiRequest', () => {
  it('sends cookie credentials and parses JSON', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetch);
    await expect(apiRequest('/me')).resolves.toEqual({ ok: true });
    expect(fetch.mock.calls[0]?.[1]).toMatchObject({ credentials: 'include' });
  });
  it('handles empty success responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    await expect(apiRequest('/auth/logout', { method: 'POST' })).resolves.toBeUndefined();
  });
  it('normalizes JSON and text error envelopes without losing status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Slow down' } }), { status: 429, headers: { 'content-type': 'application/json' } })));
    await expect(apiRequest('/auth/login')).rejects.toMatchObject({ status: 429, code: 'RATE_LIMIT_EXCEEDED', message: 'Slow down' } satisfies Partial<ApiError>);
  });
  it('uses a safe status message for non-JSON errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('sensitive upstream details', { status: 503 })));
    await expect(apiRequest('/me')).rejects.toMatchObject({ status: 503, message: 'Request failed (503)' });
  });
  it('reports network failures without exposing request data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));
    await expect(apiRequest('/auth/login', { method: 'POST', body: JSON.stringify({ password: 'secret' }) })).rejects.toThrow('Unable to reach Tech Tombola');
  });
  it('preserves caller cancellation', async () => {
    const controller = new AbortController(); controller.abort();
    vi.stubGlobal('fetch', vi.fn((_url, options: RequestInit) => options.signal?.aborted
      ? Promise.reject(options.signal.reason)
      : new Promise((_, reject) => options.signal?.addEventListener('abort', () => reject(options.signal?.reason), { once: true }))));
    await expect(apiRequest('/me', { signal: controller.signal })).rejects.toBeTruthy();
  });
  it('converts request timeouts to a safe retry message', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_url, options: RequestInit) => new Promise((_, reject) => options.signal?.addEventListener('abort', () => reject(options.signal?.reason), { once: true }))));
    const request = apiRequest('/me');
    const result = expect(request).rejects.toMatchObject({ status: 0, message: 'The request timed out. Try again.' });
    await vi.advanceTimersByTimeAsync(10_000);
    await result;
    vi.useRealTimers();
  });
});
