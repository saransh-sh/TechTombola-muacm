import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { getDbClient, closeDbConnection } from './client';
import { loadEnv } from '../config/env';

export async function runMigrations() {
  loadEnv();
  const { db } = getDbClient();
  console.log('Running database migrations...');
  await migrate(db, { migrationsFolder: './src/db/migrations' });
  console.log('Database migrations completed successfully.');
}

if (import.meta.main) {
  try {
    await runMigrations();
    await closeDbConnection();
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    await closeDbConnection();
    process.exit(1);
  }
}
