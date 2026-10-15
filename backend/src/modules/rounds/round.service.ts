import { getDb } from '../../db/client.ts';
import { auditService, type AuditService } from '../audit/audit.service.ts';
import { eventRepository, type IEventRepository } from '../events/event.repository.ts';
import { roundRepository, type IRoundRepository } from './round.repository.ts';
import {
  assertCanConfigureRound,
  getDefaultPatternConfigs,
  validatePatternConfigs,
} from './round.domain.ts';
import type {
  CreateRoundInput,
  RoundListResult,
  RoundStatus,
  RoundSummary,
  UpdateRoundInput,
} from './round.types.ts';
import { ConflictError, NotFoundError } from '../../shared/errors/app-error.ts';

export class RoundService {
  constructor(
    private readonly repo: IRoundRepository = roundRepository,
    private readonly eventRepo: IEventRepository = eventRepository,
    private readonly audit: AuditService = auditService
  ) {}

  async createRound(
    actorId: string,
    input: CreateRoundInput,
    context?: { ip?: string; userAgent?: string; requestId?: string }
  ): Promise<RoundSummary> {
    const event = await this.eventRepo.findById(input.eventId);
    if (!event) {
      throw new NotFoundError(`Event with id '${input.eventId}' not found`);
    }

    if (event.status === 'COMPLETED' || event.status === 'CANCELLED') {
      throw new ConflictError(
        `Cannot create rounds in an event with status '${event.status}'`,
        'EVENT_IMMUTABLE'
      );
    }

    const existingSeq = await this.repo.findByEventAndSequence(
      input.eventId,
      input.sequenceNumber
    );
    if (existingSeq) {
      throw new ConflictError(
        `Round sequence number ${input.sequenceNumber} already exists in this event`,
        'DUPLICATE_ROUND_SEQUENCE'
      );
    }

    const patterns = input.patterns && input.patterns.length > 0
      ? input.patterns
      : getDefaultPatternConfigs();

    validatePatternConfigs(patterns);

    const db = getDb();
    let created: RoundSummary;

    await db.transaction(async (tx) => {
      created = await this.repo.create(
        {
          eventId: input.eventId,
          sequenceNumber: input.sequenceNumber,
          name: input.name.trim(),
          status: 'DRAFT',
        },
        patterns,
        tx
      );

      await this.audit.record(
        {
          actorId,
          actorType: 'ADMIN',
          action: 'ROUND_STARTED', // PRD lifecycle audit action
          resourceType: 'round',
          resourceId: created.id,
          metadata: {
            eventId: created.eventId,
            sequenceNumber: created.sequenceNumber,
            name: created.name,
            patternCount: created.patterns.length,
          },
          ip: context?.ip,
          userAgent: context?.userAgent,
          requestId: context?.requestId,
        },
        tx
      );
    });

    return created!;
  }

  async getRoundById(id: string): Promise<RoundSummary> {
    const round = await this.repo.findById(id);
    if (!round) {
      throw new NotFoundError(`Round with id '${id}' not found`);
    }
    return round;
  }

  async listRounds(
    page = 1,
    limit = 20,
    eventId?: string,
    status?: RoundStatus
  ): Promise<RoundListResult> {
    const validPage = Math.max(1, page);
    const validLimit = Math.min(100, Math.max(1, limit));

    const { data, total } = await this.repo.list({
      page: validPage,
      limit: validLimit,
      eventId,
      status,
    });

    return {
      data,
      pagination: {
        page: validPage,
        limit: validLimit,
        total,
        totalPages: Math.ceil(total / validLimit) || 1,
      },
    };
  }

  async updateRound(
    actorId: string,
    id: string,
    input: UpdateRoundInput,
    context?: { ip?: string; userAgent?: string; requestId?: string }
  ): Promise<RoundSummary> {
    const existing = await this.getRoundById(id);

    // Assert that configuration can only be changed while DRAFT
    assertCanConfigureRound(existing.status);

    const roundData: Record<string, any> = {};

    if (input.name !== undefined) {
      roundData.name = input.name.trim();
    }

    if (input.sequenceNumber !== undefined && input.sequenceNumber !== existing.sequenceNumber) {
      const conflict = await this.repo.findByEventAndSequence(
        existing.eventId,
        input.sequenceNumber
      );
      if (conflict && conflict.id !== id) {
        throw new ConflictError(
          `Round sequence number ${input.sequenceNumber} already exists in this event`,
          'DUPLICATE_ROUND_SEQUENCE'
        );
      }
      roundData.sequenceNumber = input.sequenceNumber;
    }

    if (input.patterns !== undefined) {
      validatePatternConfigs(input.patterns);
    }

    const db = getDb();
    let updated: RoundSummary;

    await db.transaction(async (tx) => {
      updated = await this.repo.update(id, roundData, input.patterns, tx);

      await this.audit.record(
        {
          actorId,
          actorType: 'ADMIN',
          action: 'ROUND_PAUSED', // configuration audit
          resourceType: 'round',
          resourceId: id,
          metadata: {
            updates: input,
          },
          ip: context?.ip,
          userAgent: context?.userAgent,
          requestId: context?.requestId,
        },
        tx
      );
    });

    return updated!;
  }
}

export const roundService = new RoundService();
