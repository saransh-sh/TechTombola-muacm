import { describe, it, expect, beforeEach } from 'bun:test';
import { createApp } from '../../src/app.js';
import { HealthService } from '../../src/modules/health/health.service.js';
import { loadEnv } from '../../src/config/env.js';

describe('Integration — Health & Readiness Probes', () => {
  beforeEach(() => {
    loadEnv({
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/tech_tombola',
      JWT_SECRET: 'test_jwt_secret_min_32_characters_long_for_testing',
      SESSION_SECRET: 'test_session_secret_min_32_characters_long_for_testing',
      NODE_ENV: 'test',
    });
  });

  it('GET /health returns 200 OK with ISO timestamp', async () => {
    const app = createApp();

    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.status).toBe('ok');
    expect(typeof body.timestamp).toBe('string');
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
  });

  it('GET /ready returns 200 OK when database is connected', async () => {
    const mockHealthyService = new HealthService(async () => true);
    const app = createApp({
      healthOptions: { service: mockHealthyService },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/ready',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.status).toBe('ready');
    expect(body.database).toBe('connected');
  });

  it('GET /ready returns 503 Service Unavailable when database is disconnected', async () => {
    const mockUnhealthyService = new HealthService(async () => false);
    const app = createApp({
      healthOptions: { service: mockUnhealthyService },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/ready',
    });

    expect(response.statusCode).toBe(503);
    const body = response.json();
    expect(body.status).toBe('not_ready');
    expect(body.database).toBe('disconnected');
  });

  it('GET /api/v1 returns 200 OK with API root info', async () => {
    const app = createApp();

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.service).toBe('Tech Tombola API');
    expect(body.version).toBe('v1');
    expect(body.status).toBe('active');
  });
});
