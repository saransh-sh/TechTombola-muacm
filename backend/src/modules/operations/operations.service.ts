import { checkDbHealth } from '../../db/client.ts';
import packageInfo from '../../../package.json' with { type: 'json' };
import type { IOperationsRepository } from './operations.repository.ts';
import type { AuditQuery } from './operations.schemas.ts';
import { serializeAuditPage } from './operations.serializers.ts';

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
    const { page, limit } = query;
    const rows = await this.repository.listAudit({ ...query, page, limit });
    return serializeAuditPage(rows.slice(0, limit), page, limit, rows.length > limit);
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
