import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import Fastify from 'fastify';
import { createLiveRoutes } from './live.routes.ts';
import type { LiveReadService } from './live.service.ts';

const service = {
  event: async () => ({ event: null }),
  round: async () => ({ round: null }),
  draws: async () => ({ draws: [] }),
  winners: async () => ({ winners: { EARLY_5: [], TOP_LINE: [], MIDDLE_LINE: [], BOTTOM_LINE: [], FULL_HOUSE: [] } }),
} as unknown as LiveReadService;

const app = Fastify();

beforeAll(async () => {
  await app.register(createLiveRoutes(service));
  await app.ready();
});

afterAll(async () => { await app.close(); });

describe('Live Display routes', () => {
  it('exposes unauthenticated nullable Event state', async () => {
    const response = await app.inject({ method: 'GET', url: '/live/event' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ event: null });
  });

  it('exposes unauthenticated nullable Round state', async () => {
    const response = await app.inject({ method: 'GET', url: '/live/round' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ round: null });
  });

  it('exposes unauthenticated empty Draw state', async () => {
    const response = await app.inject({ method: 'GET', url: '/live/draws' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ draws: [] });
  });

  it('exposes unauthenticated grouped Winner state', async () => {
    const response = await app.inject({ method: 'GET', url: '/live/winners' });
    expect(response.statusCode).toBe(200);
    expect(response.json().winners.FULL_HOUSE).toEqual([]);
  });
});