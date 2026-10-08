import { checkDbConnection } from '../../db/client.js';

export class HealthService {
  private readonly dbChecker: () => Promise<boolean>;

  constructor(dbChecker: () => Promise<boolean> = checkDbConnection) {
    this.dbChecker = dbChecker;
  }

  getLiveness(): { status: 'ok'; timestamp: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  async getReadiness(): Promise<{
    isReady: boolean;
    status: 'ready' | 'not_ready';
    database: 'connected' | 'disconnected';
  }> {
    const isDbConnected = await this.dbChecker();

    if (!isDbConnected) {
      return {
        isReady: false,
        status: 'not_ready',
        database: 'disconnected',
      };
    }

    return {
      isReady: true,
      status: 'ready',
      database: 'connected',
    };
  }
}

export const healthService = new HealthService();
