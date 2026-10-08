import { pgTable, uuid, varchar, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { events } from './events';

export const keys = pgTable(
  'keys',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    value: varchar('value', { length: 100 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    eventValueUnique: uniqueIndex('keys_event_id_value_unique').on(table.eventId, table.value),
    eventIdx: index('keys_event_id_idx').on(table.eventId),
  })
);

export type Key = typeof keys.$inferSelect;
export type NewKey = typeof keys.$inferInsert;
