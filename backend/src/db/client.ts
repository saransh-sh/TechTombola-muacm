import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema/index.js';
import { getEnv } from '../config/env.js';

let sqlClient: ReturnType<typeof postgres> | null = null;
let drizzleDb: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDbClient() {
  if (!sqlClient) {
    const env = getEnv();
    sqlClient = postgres(env.DATABASE_URL, {
      max: env.NODE_ENV === 'test' ? 5 : 20,
      idle_timeout: 30,
      connect_timeout: 5,
    });
    drizzleDb = drizzle(sqlClient, { schema });
  }
  return { db: drizzleDb!, client: sqlClient };
}

export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop) {
    const { db } = getDbClient();
    return (db as unknown as Record<string, unknown>)[prop as string];
  },
});

export async function checkDbConnection(): Promise<boolean> {
  try {
    const { client } = getDbClient();
    await client`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

export async function closeDbConnection(): Promise<void> {
  if (sqlClient) {
    await sqlClient.end();
    sqlClient = null;
    drizzleDb = null;
  }
}
