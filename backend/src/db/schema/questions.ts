import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { rounds } from './rounds';
import { keys } from './keys';

export const questions = pgTable(
  'questions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    roundId: uuid('round_id')
      .notNull()
      .references(() => rounds.id, { onDelete: 'cascade' }),
    keyId: uuid('key_id')
      .notNull()
      .references(() => keys.id, { onDelete: 'restrict' }),
    prompt: text('prompt').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    roundIdx: index('questions_round_id_idx').on(table.roundId),
    keyIdx: index('questions_key_id_idx').on(table.keyId),
  })
);

export type Question = typeof questions.$inferSelect;
export type NewQuestion = typeof questions.$inferInsert;
