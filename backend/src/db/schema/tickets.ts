import { pgTable, uuid, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { users } from './users';
import { rounds } from './rounds';

export const tickets = pgTable(
  'tickets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    participantId: uuid('participant_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roundId: uuid('round_id')
      .notNull()
      .references(() => rounds.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    participantRoundUnique: uniqueIndex('tickets_participant_round_unique').on(
      table.participantId,
      table.roundId
    ),
    participantIdx: index('tickets_participant_id_idx').on(table.participantId),
    roundIdx: index('tickets_round_id_idx').on(table.roundId),
  })
);

export type Ticket = typeof tickets.$inferSelect;
export type NewTicket = typeof tickets.$inferInsert;
