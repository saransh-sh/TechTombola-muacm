import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { getDb, getSqlClient } from '../../db/client.ts';
import { auditLogs, type AuditLogRecord } from '../../db/schema/audit.ts';
import { claims, winners } from '../../db/schema/claims.ts';
import { draws } from '../../db/schema/draws.ts';
import { events } from '../../db/schema/events.ts';
import { rounds } from '../../db/schema/rounds.ts';
import { participantProfiles } from '../../db/schema/users.ts';
import type { AuditQuery } from './operations.schemas.ts';

export interface AuditFilters extends Pick<AuditQuery, 'actorId' | 'action' | 'from' | 'to'> {
  page: number;
  limit: number;
}

export interface DashboardReadModel {
  event: { id: string; title: string; status: string } | null;
  round: { id: string; name: string; sequenceNumber: number; status: string } | null;
  participants: number;
  drawCount: number;
  pendingClaims: number;
  verifiedWinners: number;
  recoveryRequired: boolean;
  systemStatus: 'operational' | 'recovery_required';
}

export interface SystemReadModel {
  recoveryRequiredRounds: number;
  latestMigration: { version: string; appliedAt: Date } | null;
}

export interface IOperationsRepository {
  getDashboard(): Promise<DashboardReadModel>;
  listAudit(filters: AuditFilters): Promise<AuditLogRecord[]>;
  getSystemReadModel(): Promise<SystemReadModel>;
}

export class OperationsRepository implements IOperationsRepository {
  async getDashboard(): Promise<DashboardReadModel> {
    return getDb().transaction(async (tx) => {
      const [event] = await tx
        .select({ id: events.id, title: events.title, status: events.status })
        .from(events)
        .where(eq(events.status, 'LIVE'))
        .limit(1);
      if (!event) {
        return { event: null, round: null, participants: 0, drawCount: 0, pendingClaims: 0, verifiedWinners: 0, recoveryRequired: false, systemStatus: 'operational' };
      }

      const [round] = await tx
        .select({ id: rounds.id, name: rounds.name, sequenceNumber: rounds.sequenceNumber, status: rounds.status })
        .from(rounds)
        .where(eq(rounds.eventId, event.id))
        .orderBy(
          sql`CASE ${rounds.status} WHEN 'RECOVERY_REQUIRED' THEN 0 WHEN 'ACTIVE' THEN 1 WHEN 'PAUSED' THEN 2 WHEN 'COMPLETED' THEN 3 WHEN 'READY' THEN 4 WHEN 'DRAFT' THEN 5 ELSE 6 END`,
          desc(rounds.sequenceNumber),
          desc(rounds.updatedAt),
          desc(rounds.id)
        )
        .limit(1);

      const [participantCount] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(participantProfiles)
        .where(eq(participantProfiles.eventId, event.id));

      if (!round) {
        return { event, round: null, participants: participantCount?.count ?? 0, drawCount: 0, pendingClaims: 0, verifiedWinners: 0, recoveryRequired: false, systemStatus: 'operational' };
      }

      const [[drawCount], [pendingClaims], [verifiedWinners]] = await Promise.all([
        tx.select({ count: sql<number>`count(*)::int` }).from(draws).where(eq(draws.roundId, round.id)),
        tx.select({ count: sql<number>`count(*)::int` }).from(claims).where(and(eq(claims.roundId, round.id), eq(claims.status, 'PENDING_VERIFICATION'))),
        tx.select({ count: sql<number>`count(*)::int` }).from(winners).where(and(eq(winners.roundId, round.id), eq(winners.eventId, event.id))),
      ]);

      return {
        event,
        round,
        participants: participantCount?.count ?? 0,
        drawCount: drawCount?.count ?? 0,
        pendingClaims: pendingClaims?.count ?? 0,
        verifiedWinners: verifiedWinners?.count ?? 0,
        recoveryRequired: round.status === 'RECOVERY_REQUIRED',
        systemStatus: round.status === 'RECOVERY_REQUIRED' ? 'recovery_required' : 'operational',
      };
    }, { isolationLevel: 'repeatable read', accessMode: 'read only' });
  }

  async listAudit(filters: AuditFilters): Promise<AuditLogRecord[]> {
    const conditions = [];
    if (filters.actorId) conditions.push(eq(auditLogs.actorId, filters.actorId));
    if (filters.action) conditions.push(eq(auditLogs.action, filters.action));
    if (filters.from) conditions.push(gte(auditLogs.createdAt, filters.from));
    if (filters.to) conditions.push(lte(auditLogs.createdAt, filters.to));

    return getDb()
      .select()
      .from(auditLogs)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
      .limit(filters.limit + 1)
      .offset((filters.page - 1) * filters.limit);
  }

  async getSystemReadModel(): Promise<SystemReadModel> {
    const db = getDb();
    const [recovery] = await db.select({ count: sql<number>`count(*)::int` }).from(rounds).where(eq(rounds.status, 'RECOVERY_REQUIRED'));
    const [latestMigration] = await getSqlClient().unsafe<{ version: string; applied_at: Date }[]>(
      'SELECT version, applied_at FROM schema_migrations ORDER BY version DESC LIMIT 1'
    );
    return {
      recoveryRequiredRounds: recovery?.count ?? 0,
      latestMigration: latestMigration ? { version: latestMigration.version, appliedAt: new Date(latestMigration.applied_at) } : null,
    };
  }
}

export const operationsRepository = new OperationsRepository();
