import { describe, it, expect, beforeEach } from 'bun:test';
import * as schema from '../../src/db/schema/index.js';
import { checkDbConnection } from '../../src/db/client.js';
import { loadEnv } from '../../src/config/env.js';

describe('Database — Schema and Connection Integrity', () => {
  beforeEach(() => {
    loadEnv({
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/tech_tombola',
      JWT_SECRET: 'test_jwt_secret_min_32_characters_long_for_testing',
      SESSION_SECRET: 'test_session_secret_min_32_characters_long_for_testing',
      NODE_ENV: 'test',
    });
  });

  it('exports all 12 core entity tables and enums from schema/index', () => {
    // 12 core tables
    expect(schema.users).toBeDefined();
    expect(schema.events).toBeDefined();
    expect(schema.rounds).toBeDefined();
    expect(schema.keys).toBeDefined();
    expect(schema.questions).toBeDefined();
    expect(schema.tickets).toBeDefined();
    expect(schema.ticketCells).toBeDefined();
    expect(schema.draws).toBeDefined();
    expect(schema.winningPatterns).toBeDefined();
    expect(schema.winClaims).toBeDefined();
    expect(schema.winners).toBeDefined();
    expect(schema.auditLogs).toBeDefined();

    // Enums
    expect(schema.userRoleEnum).toBeDefined();
    expect(schema.eventStatusEnum).toBeDefined();
    expect(schema.roundStatusEnum).toBeDefined();
    expect(schema.patternTypeEnum).toBeDefined();
    expect(schema.patternStatusEnum).toBeDefined();
    expect(schema.claimStatusEnum).toBeDefined();
  });

  it('checkDbConnection safely returns boolean without throwing on unreachable database', async () => {
    const isConnected = await checkDbConnection();
    expect(typeof isConnected).toBe('boolean');
  });
});
