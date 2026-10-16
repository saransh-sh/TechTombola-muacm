import { describe, expect, it } from 'bun:test';
import {
  hashPassword,
  verifyPassword,
  timingSafeDummyVerify,
  signAuthToken,
  verifyAuthToken,
} from '../../src/modules/auth/auth.domain.ts';
import { LoginRateLimiter } from '../../src/modules/auth/auth.rate-limiter.ts';
import { RateLimitError, UnauthorizedError } from '../../src/shared/errors/app-error.ts';
import { getSessionCookieOptions } from '../../src/modules/auth/auth.domain.ts';
import { resetCachedEnv } from '../../src/config/env.ts';

describe('Password hashing & verification', () => {
  it('hashes and verifies passwords using Argon2id', async () => {
    const password = 'SuperSecurePassword123!';
    const hash = await hashPassword(password);

    expect(hash.startsWith('$argon2id$')).toBe(true);

    const isValid = await verifyPassword(hash, password);
    expect(isValid).toBe(true);

    const isInvalid = await verifyPassword(hash, 'WrongPassword456!');
    expect(isInvalid).toBe(false);
  });

  it('rejects passwords shorter than 8 characters', async () => {
    expect(hashPassword('short')).rejects.toThrow(/at least 8 characters/);
  });

  it('timingSafeDummyVerify always returns false', async () => {
    const result = await timingSafeDummyVerify('randomGuessPassword');
    expect(result).toBe(false);
  });
});

describe('JWT token signing & verification', () => {
  const payload = {
    sub: '11111111-1111-1111-1111-111111111111',
    jti: '22222222-2222-2222-2222-222222222222',
    role: 'ADMIN',
    email: 'admin@techtombola.internal',
    name: 'Admin User',
  };

  it('signs and verifies valid JWT token', () => {
    const token = signAuthToken(payload);
    expect(typeof token).toBe('string');

    const decoded = verifyAuthToken(token);
    expect(decoded.sub).toBe(payload.sub);
    expect(decoded.jti).toBe(payload.jti);
    expect(decoded.role).toBe(payload.role);
    expect(decoded.email).toBe(payload.email);
  });

  it('rejects tampered or forged token', () => {
    const token = signAuthToken(payload);
    const tampered = token.slice(0, -5) + 'abcde';
    expect(() => verifyAuthToken(tampered)).toThrow(UnauthorizedError);
  });
});

describe('Login rate limiter', () => {
  it('allows up to 5 failed attempts and blocks on 6th', () => {
    const limiter = new LoginRateLimiter({ maxFailures: 5, windowMs: 60000 });
    const email = 'user@example.com';
    const ip = '10.0.0.1';

    for (let i = 0; i < 5; i++) {
      expect(() => limiter.checkLimit(email, ip)).not.toThrow();
      limiter.recordFailure(email, ip);
    }

    expect(() => limiter.checkLimit(email, ip)).toThrow(RateLimitError);
  });

  it('isolates different identifiers and IPs', () => {
    const limiter = new LoginRateLimiter({ maxFailures: 5, windowMs: 60000 });
    const email1 = 'user1@example.com';
    const email2 = 'user2@example.com';
    const ip1 = '10.0.0.1';
    const ip2 = '10.0.0.2';

    for (let i = 0; i < 5; i++) {
      limiter.recordFailure(email1, ip1);
    }

    // Blocked for email1 on ip1
    expect(() => limiter.checkLimit(email1, ip1)).toThrow(RateLimitError);

    // Allowed for email2 on ip1
    expect(() => limiter.checkLimit(email2, ip1)).not.toThrow();

    // Allowed for email1 on ip2
    expect(() => limiter.checkLimit(email1, ip2)).not.toThrow();
  });

  it('resets attempts on reset call', () => {
    const limiter = new LoginRateLimiter({ maxFailures: 5, windowMs: 60000 });
    const email = 'user@example.com';
    const ip = '10.0.0.1';

    for (let i = 0; i < 5; i++) {
      limiter.recordFailure(email, ip);
    }

    expect(() => limiter.checkLimit(email, ip)).toThrow(RateLimitError);

    limiter.reset(email, ip);
    expect(() => limiter.checkLimit(email, ip)).not.toThrow();
  });
});

describe('Session cookie security flags', () => {
  it('sets Secure only for production while keeping HttpOnly, SameSite, and path flags', () => {
    const originalEnvironment = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      resetCachedEnv();
      expect(getSessionCookieOptions()).toMatchObject({ httpOnly: true, secure: true, sameSite: 'lax', path: '/' });

      process.env.NODE_ENV = 'test';
      resetCachedEnv();
      expect(getSessionCookieOptions()).toMatchObject({ httpOnly: true, secure: false, sameSite: 'lax', path: '/' });
    } finally {
      process.env.NODE_ENV = originalEnvironment;
      resetCachedEnv();
    }
  });
});
