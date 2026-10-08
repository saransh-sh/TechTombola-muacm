import { pgTable, uuid, timestamp, pgEnum, index } from 'drizzle-orm/pg-core';
import { rounds } from './rounds';
import { users } from './users';
import { patternTypeEnum } from './winning-patterns';

export const claimStatusEnum = pgEnum('claim_status', [
  'SUBMITTED',
  'PENDING_VERIFICATION',
  'VERIFIED',
  'REJECTED',
  'REJECTED_PATTERN_ALREADY_CLOSED',
]);

export const winClaims = pgTable(
  'win_claims',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    roundId: uuid('round_id')
      .notNull()
      .references(() => rounds.id, { onDelete: 'cascade' }),
    participantId: uuid('participant_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    pattern: patternTypeEnum('pattern').notNull(),
    status: claimStatusEnum('status').notNull().default('SUBMITTED'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    roundIdx: index('win_claims_round_id_idx').on(table.roundId),
    participantIdx: index('win_claims_participant_id_idx').on(table.participantId),
    statusIdx: index('win_claims_status_idx').on(table.status),
  })
);

export type WinClaim = typeof winClaims.$inferSelect;
export type NewWinClaim = typeof winClaims.$inferInsert;
