import { asc, count, desc, eq, sql } from 'drizzle-orm';
import { getDb } from '../../db/client.ts';
import { draws, type DrawRecord, type InsertDraw } from '../../db/schema/draws.ts';
import { roundQuestions, eventKeys } from '../../db/schema/questions.ts';
import { rounds, type RoundRecord } from '../../db/schema/rounds.ts';
import type { CandidateQuestion } from './draw.domain.ts';

export interface IDrawRepository {
  create(data: InsertDraw, tx?: any): Promise<DrawRecord>;
  getLastDraw(roundId: string, tx?: any): Promise<DrawRecord | null>;
  getDrawnQuestionIds(roundId: string, tx?: any): Promise<Set<string>>;
  getDrawnKeyIds(roundId: string, tx?: any): Promise<Set<string>>;
  listDrawnKeysBySequence(roundId: string, tx?: any): Promise<Array<{ keyId: string; sequenceNumber: number }>>;
  getCandidateQuestions(roundId: string, tx?: any): Promise<CandidateQuestion[]>;
  listByRound(
    roundId: string,
    options?: { page?: number; limit?: number; order?: 'ASC' | 'DESC' },
    tx?: any
  ): Promise<{ data: DrawRecord[]; total: number }>;
  lockRoundForDraw(roundId: string, tx: any): Promise<RoundRecord | null>;
}

export class DrawRepository implements IDrawRepository {
  private getDbInstance(tx?: any) {
    return tx || getDb();
  }

  async create(data: InsertDraw, tx?: any): Promise<DrawRecord> {
    const db = this.getDbInstance(tx);
    const [created] = await db.insert(draws).values(data).returning();
    return created;
  }

  async getLastDraw(roundId: string, tx?: any): Promise<DrawRecord | null> {
    const db = this.getDbInstance(tx);
    const [last] = await db
      .select()
      .from(draws)
      .where(eq(draws.roundId, roundId))
      .orderBy(desc(draws.sequenceNumber))
      .limit(1);
    return last || null;
  }

  async getDrawnQuestionIds(roundId: string, tx?: any): Promise<Set<string>> {
    const db = this.getDbInstance(tx);
    const rows = await db
      .select({ questionId: draws.questionId })
      .from(draws)
      .where(eq(draws.roundId, roundId));
    return new Set(rows.map((r: { questionId: string }) => r.questionId));
  }

  async getDrawnKeyIds(roundId: string, tx?: any): Promise<Set<string>> {
    const db = this.getDbInstance(tx);
    const rows = await db
      .select({ keyId: draws.keyId })
      .from(draws)
      .where(eq(draws.roundId, roundId));
    return new Set(rows.map((r: { keyId: string }) => r.keyId));
  }

  async listDrawnKeysBySequence(
    roundId: string,
    tx?: any
  ): Promise<Array<{ keyId: string; sequenceNumber: number }>> {
    const db = this.getDbInstance(tx);
    return db
      .select({ keyId: draws.keyId, sequenceNumber: draws.sequenceNumber })
      .from(draws)
      .where(eq(draws.roundId, roundId))
      .orderBy(asc(draws.sequenceNumber));
  }

  async getCandidateQuestions(roundId: string, tx?: any): Promise<CandidateQuestion[]> {
    const db = this.getDbInstance(tx);
    const rows = await db
      .select({
        id: roundQuestions.id,
        roundId: roundQuestions.roundId,
        keyId: roundQuestions.keyId,
        questionText: roundQuestions.questionText,
        keyValue: eventKeys.value,
      })
      .from(roundQuestions)
      .innerJoin(eventKeys, eq(roundQuestions.keyId, eventKeys.id))
      .where(eq(roundQuestions.roundId, roundId));

    return rows;
  }

  async listByRound(
    roundId: string,
    options: { page?: number; limit?: number; order?: 'ASC' | 'DESC' } = {},
    tx?: any
  ): Promise<{ data: DrawRecord[]; total: number }> {
    const db = this.getDbInstance(tx);
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(100, Math.max(1, options.limit ?? 50));
    const offset = (page - 1) * limit;
    const orderDirection = options.order === 'DESC' ? desc(draws.sequenceNumber) : asc(draws.sequenceNumber);

    const [totalRes] = await db
      .select({ count: count() })
      .from(draws)
      .where(eq(draws.roundId, roundId));

    const total = totalRes?.count ? Number(totalRes.count) : 0;

    const data = await db
      .select()
      .from(draws)
      .where(eq(draws.roundId, roundId))
      .orderBy(orderDirection)
      .limit(limit)
      .offset(offset);

    return { data, total };
  }

  async lockRoundForDraw(roundId: string, tx: any): Promise<RoundRecord | null> {
    // Select with FOR UPDATE to serialize all draws for this round
    const rows = await tx
      .select()
      .from(rounds)
      .where(eq(rounds.id, roundId))
      .for('update');

    return rows[0] || null;
  }
}

export const drawRepository = new DrawRepository();
