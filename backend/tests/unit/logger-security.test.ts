import { describe, expect, it } from 'bun:test';
import Fastify from 'fastify';
import { PassThrough } from 'node:stream';
import { APP_LOG_REDACT_PATHS } from '../../src/shared/utils/logger.ts';

describe('application log redaction', () => {
  it('redacts credential fields using the production Fastify logger configuration', async () => {
    const destination = new PassThrough();
    let output = '';
    destination.on('data', (chunk) => { output += chunk.toString(); });
    const app = Fastify({ logger: { level: 'info', redact: APP_LOG_REDACT_PATHS, stream: destination } });

    app.log.info({
      password: 'plain-password',
      nested: { token: 'session-token', secret: 'bootstrap-secret' },
      req: { headers: { authorization: 'Bearer raw-token', cookie: 'session_token=raw-cookie', 'x-bootstrap-secret': 'raw-bootstrap' } },
    }, 'security scan');
    await app.close();

    expect(output).toContain('security scan');
    for (const secret of ['plain-password', 'session-token', 'bootstrap-secret', 'Bearer raw-token', 'session_token=raw-cookie', 'raw-bootstrap']) {
      expect(output).not.toContain(secret);
    }
  });
});
