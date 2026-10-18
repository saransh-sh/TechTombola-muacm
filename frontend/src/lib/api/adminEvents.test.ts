import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAdminEvent, getAdminEvent, listAdminEvents, updateAdminEvent } from './adminEvents';

afterEach(() => vi.unstubAllGlobals());

const event = {
  id: '0d3aa3e6-4c58-4c36-b363-d5f11640ba52', title: 'Tech Tombola', description: null, status: 'DRAFT',
  scheduledAt: null, startedAt: null, completedAt: null,
  createdAt: '2026-10-17T10:00:00.000Z', updatedAt: '2026-10-17T10:00:00.000Z',
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('admin Events API', () => {
  it('lists server-paginated Events', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ data: [event], pagination: { page: 2, limit: 10, total: 11, totalPages: 2 } }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(listAdminEvents({ page: 2, limit: 10 })).resolves.toMatchObject({ pagination: { page: 2, total: 11 } });
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/v1/admin/events?page=2&limit=10');
  });

  it('gets one Event and encodes its id', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(response({ event })));
    vi.stubGlobal('fetch', fetchMock);
    await expect(getAdminEvent(event.id)).resolves.toEqual(event);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`/api/v1/admin/events/${event.id}`);
  });

  it('creates and updates metadata only through the documented routes', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(response({ event })));
    vi.stubGlobal('fetch', fetchMock);
    await createAdminEvent({ title: 'Tech Tombola' });
    await updateAdminEvent(event.id, { title: 'Updated event' });
    expect(fetchMock.mock.calls.map(([url, options]) => [url, (options as RequestInit).method])).toEqual([
      ['/api/v1/admin/events', 'POST'], [`/api/v1/admin/events/${event.id}`, 'PATCH'],
    ]);
    expect(JSON.parse((fetchMock.mock.calls[1]?.[1] as RequestInit).body as string)).toEqual({ title: 'Updated event' });
  });

  it('rejects malformed server Event records', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ event: { ...event, status: 'UNKNOWN' } })));
    await expect(getAdminEvent(event.id)).rejects.toThrow();
  });
});
