import { describe, it, expect } from 'bun:test';
import { loadEnv, getEnv } from '../../../src/config/env.js';

describe('Config — Environment Validation (loadEnv & getEnv)', () => {
  const validBaseEnv = {
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/tech_tombola',
    JWT_SECRET: 'a_very_long_secret_key_exceeding_32_characters_for_jwt_auth',
    SESSION_SECRET: 'another_very_long_secret_key_exceeding_32_characters_for_sessions',
  };

  it('successfully parses valid environment variables and applies defaults', () => {
    const env = loadEnv(validBaseEnv);
    expect(env.DATABASE_URL).toBe(validBaseEnv.DATABASE_URL);
    expect(env.JWT_SECRET).toBe(validBaseEnv.JWT_SECRET);
    expect(env.SESSION_SECRET).toBe(validBaseEnv.SESSION_SECRET);
    expect(env.PORT).toBe(3000);
    expect(env.NODE_ENV).toBe('development');
    expect(env.LOG_LEVEL).toBe('info');
    expect(env.CORS_ORIGIN).toBe('*');
  });

  it('getEnv retrieves cached parsed environment', () => {
    loadEnv(validBaseEnv);
    const env = getEnv();
    expect(env.DATABASE_URL).toBe(validBaseEnv.DATABASE_URL);
  });

  it('coerces and respects custom PORT', () => {
    const env = loadEnv({
      ...validBaseEnv,
      PORT: '8080',
    });
    expect(env.PORT).toBe(8080);
  });

  it('throws an error if DATABASE_URL is missing', () => {
    const invalidEnv = { ...validBaseEnv };
    delete (invalidEnv as Record<string, unknown>).DATABASE_URL;

    expect(() => loadEnv(invalidEnv)).toThrow(/DATABASE_URL/);
  });

  it('throws an error if DATABASE_URL is not a valid URL', () => {
    const invalidEnv = {
      ...validBaseEnv,
      DATABASE_URL: 'not-a-valid-url',
    };

    expect(() => loadEnv(invalidEnv)).toThrow(/DATABASE_URL/);
  });

  it('throws an error if JWT_SECRET is less than 32 characters', () => {
    const invalidEnv = {
      ...validBaseEnv,
      JWT_SECRET: 'short-secret',
    };

    expect(() => loadEnv(invalidEnv)).toThrow(/JWT_SECRET must be at least 32 characters/);
  });

  it('throws an error if SESSION_SECRET is less than 32 characters', () => {
    const invalidEnv = {
      ...validBaseEnv,
      SESSION_SECRET: 'short-secret',
    };

    expect(() => loadEnv(invalidEnv)).toThrow(/SESSION_SECRET must be at least 32 characters/);
  });

  it('rejects invalid NODE_ENV values', () => {
    const invalidEnv = {
      ...validBaseEnv,
      NODE_ENV: 'invalid_environment',
    };

    expect(() => loadEnv(invalidEnv)).toThrow(/NODE_ENV/);
  });
});
