import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const healthCheckFixtures = pgTable('health_check_fixtures', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
