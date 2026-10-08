import { pgTable, uuid, integer, timestamp, pgEnum, index } from 'drizzle-orm/pg-core';
import { events } from './events';

export const roundStatusEnum = pgEnum('round_status', [
  'DRAFT',
  'READY',
  'ACTIVE',
  'COMPLETED',
  'PAUSED',
  'RECOVERY_REQUIRED',
]);

export const rounds = pgTable(
  'rounds',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    roundNumber: integer('round_number').notNull(),
    status: roundStatusEnum('status').notNull().default('DRAFT'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    eventIdx: index('rounds_event_id_idx').on(table.eventId),
  })
);

export type Round = typeof rounds.$inferSelect;
export type NewRound = typeof rounds.$inferInsert;
