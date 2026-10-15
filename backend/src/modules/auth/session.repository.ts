import { and, eq, gt, isNull } from 'drizzle-orm';
import { getDb } from '../../db/client.ts';
import { sessions, type SessionRecord, type InsertSession } from '../../db/schema/users.ts';

export interface ISessionRepository {
  create(data: InsertSession, tx?: any): Promise<SessionRecord>;
  findActiveById(id: string, tx?: any): Promise<SessionRecord | null>;
  revoke(id: string, tx?: any): Promise<void>;
  revokeAllForUser(userId: string, tx?: any): Promise<void>;
}

export class SessionRepository implements ISessionRepository {
  private getClient(tx?: any) {
    return tx || getDb();
  }

  async create(data: InsertSession, tx?: any): Promise<SessionRecord> {
    const client = this.getClient(tx);
    const [record] = await client.insert(sessions).values(data).returning();
    return record;
  }

  async findActiveById(id: string, tx?: any): Promise<SessionRecord | null> {
    const client = this.getClient(tx);
    const now = new Date();

    const [record] = await client
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.id, id),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, now)
        )
      )
      .limit(1);

    return record || null;
  }

  async revoke(id: string, tx?: any): Promise<void> {
    const client = this.getClient(tx);
    await client
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(eq(sessions.id, id));
  }

  async revokeAllForUser(userId: string, tx?: any): Promise<void> {
    const client = this.getClient(tx);
    await client
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
  }
}

export const sessionRepository = new SessionRepository();
