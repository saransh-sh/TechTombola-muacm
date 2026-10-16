import { and, count, desc, eq } from 'drizzle-orm';
import { getDb } from '../../db/client.ts';
import { claims, type ClaimRecord, type InsertClaim } from '../../db/schema/claims.ts';
import { roundPatterns, type RoundPatternRecord } from '../../db/schema/rounds.ts';

export interface IClaimRepository {
  create(data: InsertClaim, tx?: any): Promise<ClaimRecord>;
  findExistingClaim(
    roundId: string,
    participantId: string,
    patternType: string,
    tx?: any
  ): Promise<ClaimRecord | null>;
  listByParticipant(
    participantId: string,
    options?: { page?: number; limit?: number },
    tx?: any
  ): Promise<{ data: ClaimRecord[]; total: number }>;
  getRoundPattern(
    roundId: string,
    patternType: string,
    tx?: any
  ): Promise<RoundPatternRecord | null>;
  countVerifiedWinners(
    roundId: string,
    patternType: string,
    tx?: any
  ): Promise<number>;
}

export class ClaimRepository implements IClaimRepository {
  private getDbInstance(tx?: any) {
    return tx || getDb();
  }

  async create(data: InsertClaim, tx?: any): Promise<ClaimRecord> {
    const db = this.getDbInstance(tx);
    const [created] = await db.insert(claims).values(data).returning();
    return created;
  }

  async findExistingClaim(
    roundId: string,
    participantId: string,
    patternType: string,
    tx?: any
  ): Promise<ClaimRecord | null> {
    const db = this.getDbInstance(tx);
    const [existing] = await db
      .select()
      .from(claims)
      .where(
        and(
          eq(claims.roundId, roundId),
          eq(claims.participantId, participantId),
          eq(claims.patternType, patternType)
        )
      )
      .limit(1);

    return existing || null;
  }

  async listByParticipant(
    participantId: string,
    options: { page?: number; limit?: number } = {},
    tx?: any
  ): Promise<{ data: ClaimRecord[]; total: number }> {
    const db = this.getDbInstance(tx);
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(100, Math.max(1, options.limit ?? 50));
    const offset = (page - 1) * limit;

    const [totalRes] = await db
      .select({ count: count() })
      .from(claims)
      .where(eq(claims.participantId, participantId));

    const total = totalRes?.count ? Number(totalRes.count) : 0;

    const data = await db
      .select()
      .from(claims)
      .where(eq(claims.participantId, participantId))
      .orderBy(desc(claims.createdAt))
      .limit(limit)
      .offset(offset);

    return { data, total };
  }

  async getRoundPattern(
    roundId: string,
    patternType: string,
    tx?: any
  ): Promise<RoundPatternRecord | null> {
    const db = this.getDbInstance(tx);
    const [pattern] = await db
      .select()
      .from(roundPatterns)
      .where(
        and(
          eq(roundPatterns.roundId, roundId),
          eq(roundPatterns.patternType, patternType)
        )
      )
      .limit(1);

    return pattern || null;
  }

  async countVerifiedWinners(
    roundId: string,
    patternType: string,
    tx?: any
  ): Promise<number> {
    const db = this.getDbInstance(tx);
    const [res] = await db
      .select({ count: count() })
      .from(claims)
      .where(
        and(
          eq(claims.roundId, roundId),
          eq(claims.patternType, patternType),
          eq(claims.status, 'VERIFIED')
        )
      );

    return res?.count ? Number(res.count) : 0;
  }
}

export const claimRepository = new ClaimRepository();
