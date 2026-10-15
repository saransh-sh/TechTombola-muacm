import { and, count, desc, eq, inArray } from 'drizzle-orm';
import { getDb } from '../../db/client.ts';
import {
  rounds,
  roundPatterns,
  type RoundRecord,
  type RoundPatternRecord,
  type InsertRound,
} from '../../db/schema/rounds.ts';
import type {
  PatternConfig,
  PatternSummary,
  RoundStatus,
  RoundSummary,
} from './round.types.ts';

export interface IRoundRepository {
  create(roundData: InsertRound, patterns: PatternConfig[], tx?: any): Promise<RoundSummary>;
  findById(id: string, tx?: any): Promise<RoundSummary | null>;
  findByEventAndSequence(eventId: string, sequenceNumber: number, tx?: any): Promise<RoundSummary | null>;
  list(options: { page: number; limit: number; eventId?: string; status?: RoundStatus }, tx?: any): Promise<{ data: RoundSummary[]; total: number }>;
  update(id: string, roundData: Partial<InsertRound>, patterns?: PatternConfig[], tx?: any): Promise<RoundSummary>;
}

export class RoundRepository implements IRoundRepository {
  private getClient(tx?: any) {
    return tx || getDb();
  }

  private mapPattern(r: RoundPatternRecord): PatternSummary {
    return {
      id: r.id,
      roundId: r.roundId,
      patternType: r.patternType as any,
      enabled: r.enabled,
      maxWinners: r.maxWinners,
      status: r.status as any,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  private mapRound(r: RoundRecord, patterns: RoundPatternRecord[] = []): RoundSummary {
    return {
      id: r.id,
      eventId: r.eventId,
      sequenceNumber: r.sequenceNumber,
      name: r.name,
      status: r.status as RoundStatus,
      patterns: patterns.map((p) => this.mapPattern(p)),
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  async create(roundData: InsertRound, patterns: PatternConfig[], tx?: any): Promise<RoundSummary> {
    const client = this.getClient(tx);

    const [roundRecord] = await client.insert(rounds).values(roundData).returning();

    let patternRecords: RoundPatternRecord[] = [];
    if (patterns.length > 0) {
      patternRecords = await client
        .insert(roundPatterns)
        .values(
          patterns.map((p) => ({
            roundId: roundRecord.id,
            patternType: p.patternType,
            enabled: p.enabled,
            maxWinners: p.maxWinners,
            status: 'OPEN',
          }))
        )
        .returning();
    }

    return this.mapRound(roundRecord, patternRecords);
  }

  async findById(id: string, tx?: any): Promise<RoundSummary | null> {
    const client = this.getClient(tx);
    const [roundRecord] = await client.select().from(rounds).where(eq(rounds.id, id)).limit(1);
    if (!roundRecord) return null;

    const patternRecords = await client
      .select()
      .from(roundPatterns)
      .where(eq(roundPatterns.roundId, id));

    return this.mapRound(roundRecord, patternRecords);
  }

  async findByEventAndSequence(
    eventId: string,
    sequenceNumber: number,
    tx?: any
  ): Promise<RoundSummary | null> {
    const client = this.getClient(tx);
    const [roundRecord] = await client
      .select()
      .from(rounds)
      .where(and(eq(rounds.eventId, eventId), eq(rounds.sequenceNumber, sequenceNumber)))
      .limit(1);

    if (!roundRecord) return null;

    const patternRecords = await client
      .select()
      .from(roundPatterns)
      .where(eq(roundPatterns.roundId, roundRecord.id));

    return this.mapRound(roundRecord, patternRecords);
  }

  async list(
    options: { page: number; limit: number; eventId?: string; status?: RoundStatus },
    tx?: any
  ): Promise<{ data: RoundSummary[]; total: number }> {
    const client = this.getClient(tx);
    const offset = (options.page - 1) * options.limit;

    const conditions = [];
    if (options.eventId) conditions.push(eq(rounds.eventId, options.eventId));
    if (options.status) conditions.push(eq(rounds.status, options.status));
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalRow] = await client
      .select({ count: count() })
      .from(rounds)
      .where(whereClause);

    const total = Number(totalRow?.count || 0);

    const roundRows: RoundRecord[] = await client
      .select()
      .from(rounds)
      .where(whereClause)
      .orderBy(rounds.sequenceNumber)
      .limit(options.limit)
      .offset(offset);

    if (roundRows.length === 0) {
      return { data: [], total };
    }

    const roundIds = roundRows.map((r) => r.id);
    const patternRows: RoundPatternRecord[] = await client
      .select()
      .from(roundPatterns)
      .where(inArray(roundPatterns.roundId, roundIds));

    const patternsByRound = new Map<string, RoundPatternRecord[]>();
    for (const p of patternRows) {
      if (!patternsByRound.has(p.roundId)) {
        patternsByRound.set(p.roundId, []);
      }
      patternsByRound.get(p.roundId)!.push(p);
    }

    return {
      data: roundRows.map((r) => this.mapRound(r, patternsByRound.get(r.id) || [])),
      total,
    };
  }

  async update(
    id: string,
    roundData: Partial<InsertRound>,
    patterns?: PatternConfig[],
    tx?: any
  ): Promise<RoundSummary> {
    const client = this.getClient(tx);

    let roundRecord: RoundRecord;
    if (Object.keys(roundData).length > 0) {
      const [updated] = await client
        .update(rounds)
        .set({
          ...roundData,
          updatedAt: new Date(),
        })
        .where(eq(rounds.id, id))
        .returning();
      roundRecord = updated;
    } else {
      const [existing] = await client.select().from(rounds).where(eq(rounds.id, id)).limit(1);
      roundRecord = existing;
    }

    if (patterns !== undefined) {
      // Upsert or replace pattern configs
      for (const p of patterns) {
        await client
          .insert(roundPatterns)
          .values({
            roundId: id,
            patternType: p.patternType,
            enabled: p.enabled,
            maxWinners: p.maxWinners,
            status: 'OPEN',
          })
          .onConflictDoUpdate({
            target: [roundPatterns.roundId, roundPatterns.patternType],
            set: {
              enabled: p.enabled,
              maxWinners: p.maxWinners,
              updatedAt: new Date(),
            },
          });
      }
    }

    const patternRecords = await client
      .select()
      .from(roundPatterns)
      .where(eq(roundPatterns.roundId, id));

    return this.mapRound(roundRecord, patternRecords);
  }
}

export const roundRepository = new RoundRepository();
