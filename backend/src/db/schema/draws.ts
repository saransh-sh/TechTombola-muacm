import { pgTable, uuid, integer, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { rounds } from './rounds';
import { questions } from './questions';
import { keys } from './keys';

export const draws = pgTable(
  'draws',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    roundId: uuid('round_id')
      .notNull()
      .references(() => rounds.id, { onDelete: 'cascade' }),
    questionId: uuid('question_id')
      .notNull()
      .references(() => questions.id, { onDelete: 'restrict' }),
    keyId: uuid('key_id')
      .notNull()
      .references(() => keys.id, { onDelete: 'restrict' }),
    sequenceNumber: integer('sequence_number').notNull(),
    drawnAt: timestamp('drawn_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    roundQuestionUnique: uniqueIndex('draws_round_question_unique').on(
      table.roundId,
      table.questionId
    ),
    roundSequenceUnique: uniqueIndex('draws_round_sequence_unique').on(
      table.roundId,
      table.sequenceNumber
    ),
    roundIdx: index('draws_round_id_idx').on(table.roundId),
  })
);

export type Draw = typeof draws.$inferSelect;
export type NewDraw = typeof draws.$inferInsert;
