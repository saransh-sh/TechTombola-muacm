import { pgTable, uuid, integer, timestamp, pgEnum, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { rounds } from './rounds';

export const patternTypeEnum = pgEnum('pattern_type', [
  'EARLY_5',
  'TOP_LINE',
  'MIDDLE_LINE',
  'BOTTOM_LINE',
  'FULL_HOUSE',
]);

export const patternStatusEnum = pgEnum('pattern_status', ['OPEN', 'CLOSED']);

export const winningPatterns = pgTable(
  'winning_patterns',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    roundId: uuid('round_id')
      .notNull()
      .references(() => rounds.id, { onDelete: 'cascade' }),
    pattern: patternTypeEnum('pattern').notNull(),
    status: patternStatusEnum('status').notNull().default('OPEN'),
    maxWinners: integer('max_winners').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    roundPatternUnique: uniqueIndex('winning_patterns_round_pattern_unique').on(
      table.roundId,
      table.pattern
    ),
    roundIdx: index('winning_patterns_round_id_idx').on(table.roundId),
  })
);

export type WinningPattern = typeof winningPatterns.$inferSelect;
export type NewWinningPattern = typeof winningPatterns.$inferInsert;
