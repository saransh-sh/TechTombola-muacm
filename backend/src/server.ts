import { createApp } from './app.js';
import { loadEnv } from './config/env.js';
import { closeDbConnection } from './db/client.js';

const env = loadEnv();
const app = createApp();

async function startServer() {
  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    app.log.info(`Tech Tombola backend server listening on port ${env.PORT}`);
  } catch (err) {
    app.log.error(err, 'Failed to start Tech Tombola backend server');
    process.exit(1);
  }
}

async function shutdown(signal: string) {
  app.log.info(`Received ${signal}. Gracefully shutting down...`);
  try {
    await app.close();
    await closeDbConnection();
    app.log.info('Server and database connections successfully closed.');
    process.exit(0);
  } catch (err) {
    app.log.error(err, 'Error during graceful shutdown');
    process.exit(1);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

startServer();
