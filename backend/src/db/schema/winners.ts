import { pgTable, uuid, timestamp, index } from 'drizzle-orm/pg-core';
import { rounds } from './rounds';
import { users } from './users';
import { winClaims } from './win-claims';
import { patternTypeEnum } from './winning-patterns';

export const winners = pgTable(
  'winners',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    roundId: uuid('round_id')
      .notNull()
      .references(() => rounds.id, { onDelete: 'cascade' }),
    participantId: uuid('participant_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    pattern: patternTypeEnum('pattern').notNull(),
    claimId: uuid('claim_id')
      .notNull()
      .references(() => winClaims.id, { onDelete: 'cascade' }),
    verifiedAt: timestamp('verified_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    roundIdx: index('winners_round_id_idx').on(table.roundId),
    participantIdx: index('winners_participant_id_idx').on(table.participantId),
  })
);

export type Winner = typeof winners.$inferSelect;
export type NewWinner = typeof winners.$inferInsert;
