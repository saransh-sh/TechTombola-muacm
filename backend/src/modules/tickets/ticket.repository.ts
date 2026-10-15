import { and, count, desc, eq } from 'drizzle-orm';
import { getDb } from '../../db/client.ts';
import { tickets, ticketCells, type TicketCellRecord, type TicketRecord } from '../../db/schema/tickets.ts';
import { roundQuestions, eventKeys } from '../../db/schema/questions.ts';
import type { GeneratedCell, TicketKey } from './ticket.domain.ts';
import type { ITicketRepository } from './ticket.types.ts';

export class TicketRepository implements ITicketRepository {
  private getClient(tx?: any) {
    return tx || getDb();
  }

  async getRoundKeys(roundId: string, tx?: any): Promise<TicketKey[]> {
    const db = this.getClient(tx);
    const rows = await db
      .select({
        id: eventKeys.id,
        value: eventKeys.value,
      })
      .from(roundQuestions)
      .innerJoin(eventKeys, eq(roundQuestions.keyId, eventKeys.id))
      .where(eq(roundQuestions.roundId, roundId));

    // Deduplicate by key id just in case
    const map = new Map<string, TicketKey>();
    for (const r of rows) {
      if (!map.has(r.id)) {
        map.set(r.id, { id: r.id, value: r.value });
      }
    }
    return Array.from(map.values());
  }

  async findExistingTicketParticipantIds(roundId: string, tx?: any): Promise<Set<string>> {
    const db = this.getClient(tx);
    const rows = await db
      .select({ participantId: tickets.participantId })
      .from(tickets)
      .where(eq(tickets.roundId, roundId));

    return new Set(rows.map((r: { participantId: string }) => r.participantId));
  }

  async createTicketWithCells(
    data: {
      roundId: string;
      participantId: string;
      eventId: string;
      cells: GeneratedCell[];
    },
    tx?: any
  ): Promise<TicketRecord> {
    const db = this.getClient(tx);

    const [ticket] = await db
      .insert(tickets)
      .values({
        roundId: data.roundId,
        participantId: data.participantId,
        eventId: data.eventId,
      })
      .returning();

    if (!ticket) {
      throw new Error('Failed to insert ticket');
    }

    const cellInserts = data.cells.map((cell) => ({
      ticketId: ticket.id,
      keyId: cell.keyId,
      rowIndex: cell.rowIndex,
      colIndex: cell.colIndex,
    }));

    await db.insert(ticketCells).values(cellInserts);
    return ticket;
  }

  async findByParticipantAndRound(
    participantId: string,
    roundId: string,
    tx?: any
  ): Promise<(TicketRecord & { cells: Array<TicketCellRecord & { keyValue: string }> }) | null> {
    const db = this.getClient(tx);

    const [ticket] = await db
      .select()
      .from(tickets)
      .where(and(eq(tickets.participantId, participantId), eq(tickets.roundId, roundId)))
      .limit(1);

    if (!ticket) {
      return null;
    }

    const cells = await db
      .select({
        id: ticketCells.id,
        ticketId: ticketCells.ticketId,
        keyId: ticketCells.keyId,
        rowIndex: ticketCells.rowIndex,
        colIndex: ticketCells.colIndex,
        createdAt: ticketCells.createdAt,
        keyValue: eventKeys.value,
      })
      .from(ticketCells)
      .innerJoin(eventKeys, eq(ticketCells.keyId, eventKeys.id))
      .where(eq(ticketCells.ticketId, ticket.id));

    cells.sort((a: { rowIndex: number; colIndex: number }, b: { rowIndex: number; colIndex: number }) => {
      if (a.rowIndex !== b.rowIndex) return a.rowIndex - b.rowIndex;
      return a.colIndex - b.colIndex;
    });

    return {
      ...ticket,
      cells,
    };
  }

  async findTicketById(
    ticketId: string,
    tx?: any
  ): Promise<(TicketRecord & { cells: Array<TicketCellRecord & { keyValue: string }> }) | null> {
    const db = this.getClient(tx);

    const [ticket] = await db
      .select()
      .from(tickets)
      .where(eq(tickets.id, ticketId))
      .limit(1);

    if (!ticket) {
      return null;
    }

    const cells = await db
      .select({
        id: ticketCells.id,
        ticketId: ticketCells.ticketId,
        keyId: ticketCells.keyId,
        rowIndex: ticketCells.rowIndex,
        colIndex: ticketCells.colIndex,
        createdAt: ticketCells.createdAt,
        keyValue: eventKeys.value,
      })
      .from(ticketCells)
      .innerJoin(eventKeys, eq(ticketCells.keyId, eventKeys.id))
      .where(eq(ticketCells.ticketId, ticket.id));

    cells.sort((a: { rowIndex: number; colIndex: number }, b: { rowIndex: number; colIndex: number }) => {
      if (a.rowIndex !== b.rowIndex) return a.rowIndex - b.rowIndex;
      return a.colIndex - b.colIndex;
    });

    return {
      ...ticket,
      cells,
    };
  }

  async listTicketsForRound(
    roundId: string,
    options: { page: number; limit: number },
    tx?: any
  ): Promise<{ data: TicketRecord[]; total: number }> {
    const db = this.getClient(tx);
    const { page, limit } = options;
    const offset = (page - 1) * limit;

    const [totalResult] = await db
      .select({ count: count() })
      .from(tickets)
      .where(eq(tickets.roundId, roundId));

    const total = Number(totalResult?.count ?? 0);

    const data = await db
      .select()
      .from(tickets)
      .where(eq(tickets.roundId, roundId))
      .orderBy(desc(tickets.createdAt))
      .limit(limit)
      .offset(offset);

    return { data, total };
  }
}
