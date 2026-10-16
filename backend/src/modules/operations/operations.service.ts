import { checkDbHealth } from '../../db/client.ts';
import packageInfo from '../../../package.json' with { type: 'json' };
import type { IOperationsRepository } from './operations.repository.ts';
import type { AuditQuery } from './operations.schemas.ts';
import { serializeAuditPage } from './operations.serializers.ts';
import { ValidationError } from '../../shared/errors/app-error.ts';

function decodeAuditCursor(cursor: string): { createdAt: string; id: string } {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as { createdAt?: unknown; id?: unknown };
    if (typeof parsed.createdAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(parsed.createdAt) || !Number.isFinite(Date.parse(parsed.createdAt)) || typeof parsed.id !== 'string' || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(parsed.id)) throw new Error('invalid cursor');
    return { createdAt: parsed.createdAt, id: parsed.id };
  } catch {
    throw new ValidationError('Audit cursor is invalid');
  }
}

function encodeAuditCursor(record: { cursorCreatedAt?: string; createdAt: Date; id: string }): string {
  const createdAt = record.cursorCreatedAt ?? record.createdAt.toISOString().replace(/\.(\d{3})Z$/, (_, milliseconds: string) => `.${milliseconds}000Z`);
  return Buffer.from(JSON.stringify({ createdAt, id: record.id })).toString('base64url');
}

export interface ConnectionCounter { connectionCount(): number; }

export class OperationsService {
  constructor(
    private readonly repository: IOperationsRepository,
    private readonly connections?: ConnectionCounter,
    private readonly healthCheck: typeof checkDbHealth = checkDbHealth,
    private readonly version = process.env.APP_VERSION || packageInfo.version
  ) {}

  async getDashboard() {
    const [readModel, connectedConnections] = await Promise.all([
      this.repository.getDashboard(),
      Promise.resolve(this.connections?.connectionCount() ?? 0),
    ]);
    return { ...readModel, connectedConnections };
  }

  async listAudit(query: AuditQuery) {
    const { cursor, ...filters } = query;
    const rows = await this.repository.listAudit({ ...filters, limit: query.limit, cursor: cursor ? decodeAuditCursor(cursor) : undefined });
    const items = rows.slice(0, query.limit);
    const hasMore = rows.length > query.limit;
    const last = items.at(-1);
    return serializeAuditPage(items, query.limit, hasMore, hasMore && last ? encodeAuditCursor(last) : null);
  }

  async getSystem() {
    const database = await this.healthCheck(1500);
    if (!database.ok) {
      return {
        version: this.version,
        readiness: { status: 'not_ready', dependencies: { database: 'unavailable', configuration: 'available' } },
        recoveryRequiredRounds: null,
        latestMigration: null,
      };
    }

    try {
      const readModel = await this.repository.getSystemReadModel();
      return {
        version: this.version,
        readiness: { status: 'ready', dependencies: { database: 'available', configuration: 'available' } },
        ...readModel,
      };
    } catch {
      return {
        version: this.version,
        readiness: { status: 'not_ready', dependencies: { database: 'available', configuration: 'available', operationsSchema: 'unavailable' } },
        recoveryRequiredRounds: null,
        latestMigration: null,
      };
    }
  }
}
