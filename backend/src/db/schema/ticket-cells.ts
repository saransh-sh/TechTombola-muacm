import { pgTable, uuid, integer, boolean, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { tickets } from './tickets';
import { keys } from './keys';

export const ticketCells = pgTable(
  'ticket_cells',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => tickets.id, { onDelete: 'cascade' }),
    rowIdx: integer('row_idx').notNull(),
    colIdx: integer('col_idx').notNull(),
    keyId: uuid('key_id').references(() => keys.id, { onDelete: 'restrict' }),
    isMarked: boolean('is_marked').notNull().default(false),
    markedAt: timestamp('marked_at', { withTimezone: true }),
  },
  (table) => ({
    ticketRowColUnique: uniqueIndex('ticket_cells_ticket_row_col_unique').on(
      table.ticketId,
      table.rowIdx,
      table.colIdx
    ),
    ticketIdx: index('ticket_cells_ticket_id_idx').on(table.ticketId),
    keyIdx: index('ticket_cells_key_id_idx').on(table.keyId),
  })
);

export type TicketCell = typeof ticketCells.$inferSelect;
export type NewTicketCell = typeof ticketCells.$inferInsert;
