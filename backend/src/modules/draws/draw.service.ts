import { and, desc, eq, inArray } from 'drizzle-orm';
import { getDb } from '../../db/client.ts';
import { rounds } from '../../db/schema/rounds.ts';
import { participantProfiles } from '../../db/schema/users.ts';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../shared/errors/index.ts';
import type { AuditService } from '../audit/audit.service.ts';
import { auditService } from '../audit/audit.service.ts';
import type { IRoundRepository } from '../rounds/round.repository.ts';
import { roundRepository } from '../rounds/round.repository.ts';
import type { IIdempotencyRepository } from '../../shared/idempotency/idempotency.repository.ts';
import { idempotencyRepository } from '../../shared/idempotency/idempotency.repository.ts';
import { drawRepository, type IDrawRepository } from './draw.repository.ts';
import {
  computeNextDrawSequence,
  filterEligibleQuestions,
  selectManualQuestion,
  selectRandomQuestion,
  validateRoundActiveForDraw,
} from './draw.domain.ts';
import type { DrawDto, ParticipantDrawDto } from './draw.types.ts';

export interface RealtimePublisher {
  broadcastCommitted(event: any): Promise<void>;
}

export class DrawService {
  private realtimePublisher?: RealtimePublisher;

  constructor(
    private readonly drawRepo: IDrawRepository = drawRepository,
    private readonly roundRepo: IRoundRepository = roundRepository,
    private readonly audit: AuditService = auditService,
    private readonly idempotencyRepo?: IIdempotencyRepository
  ) {}

  setRealtimePublisher(publisher: RealtimePublisher): void {
    this.realtimePublisher = publisher;
  }

  async drawRandom(params: {
    actorId: string;
    roundId: string;
    idempotencyKey: string;
    rng?: (count: number) => number;
  }): Promise<{ draw: DrawDto }> {
    const { actorId, roundId, idempotencyKey, rng } = params;

    if (!idempotencyKey || typeof idempotencyKey !== 'string' || idempotencyKey.trim().length === 0) {
      throw new ValidationError('Idempotency-Key header is required for draw operations');
    }

    const key = idempotencyKey.trim();

    // 1. Idempotency Check
    if (this.idempotencyRepo) {
      const cached = await this.idempotencyRepo.find(key);
      if (cached) {
        return cached as { draw: DrawDto };
      }
    }

    // 2. Perform Draw inside transaction with FOR UPDATE lock on the round
    const db = getDb();
    const { result, eventId, draw } = await db.transaction(async (tx) => {
      const round = await this.drawRepo.lockRoundForDraw(roundId, tx);
      if (!round) {
        throw new NotFoundError('Round not found');
      }

      validateRoundActiveForDraw(round.status);

      const drawnQuestionIds = await this.drawRepo.getDrawnQuestionIds(roundId, tx);
      const drawnKeyIds = await this.drawRepo.getDrawnKeyIds(roundId, tx);
      const candidates = await this.drawRepo.getCandidateQuestions(roundId, tx);

      const eligible = filterEligibleQuestions(candidates, drawnQuestionIds, drawnKeyIds);
      const selected = selectRandomQuestion(eligible, rng);

      const lastDraw = await this.drawRepo.getLastDraw(roundId, tx);
      const sequenceNumber = computeNextDrawSequence(lastDraw?.sequenceNumber);

      const created = await this.drawRepo.create(
        {
          roundId,
          questionId: selected.id,
          keyId: selected.keyId,
          sequenceNumber,
          drawMode: 'RANDOM',
          questionText: selected.questionText,
          keyValue: selected.keyValue,
          drawnBy: actorId,
        },
        tx
      );

      await this.audit.record(
        {
          actorId,
          actorType: 'ADMIN',
          action: 'DRAW_CREATED',
          resourceType: 'DRAW',
          resourceId: created.id,
          metadata: {
            roundId,
            sequenceNumber,
            questionId: selected.id,
            keyId: selected.keyId,
            drawMode: 'RANDOM',
          },
        },
        tx
      );

      const res: { draw: DrawDto } = {
        draw: {
          id: created.id,
          roundId: created.roundId,
          sequenceNumber: created.sequenceNumber,
          drawMode: created.drawMode,
          questionId: created.questionId,
          keyId: created.keyId,
          questionText: created.questionText,
          keyValue: created.keyValue,
          drawnAt: created.drawnAt.toISOString(),
        },
      };

      if (this.idempotencyRepo) {
        await this.idempotencyRepo.save(key, 'DRAW', res, tx);
      }

      return { result: res, eventId: round.eventId, draw: created };
    });

    // 3. Post-commit realtime broadcast
    if (this.realtimePublisher) {
      try {
        await this.realtimePublisher.broadcastCommitted({
          type: 'DRAW_CREATED',
          eventId,
          roundId,
          occurredAt: new Date().toISOString(),
          payload: {
            sequence: draw.sequenceNumber,
            key: draw.keyValue,
            question: draw.questionText,
            drawnAt: draw.drawnAt.toISOString(),
          },
        });
      } catch (err) {
        // Broadcast failure is observable/logged, but transaction is already committed
        console.error('Failed to broadcast DRAW_CREATED event after transaction commit:', err);
      }
    }

    return result;
  }

  async drawManual(params: {
    actorId: string;
    roundId: string;
    questionId: string;
    idempotencyKey: string;
  }): Promise<{ draw: DrawDto }> {
    const { actorId, roundId, questionId, idempotencyKey } = params;

    if (!idempotencyKey || typeof idempotencyKey !== 'string' || idempotencyKey.trim().length === 0) {
      throw new ValidationError('Idempotency-Key header is required for draw operations');
    }

    const key = idempotencyKey.trim();

    // 1. Idempotency Check
    if (this.idempotencyRepo) {
      const cached = await this.idempotencyRepo.find(key);
      if (cached) {
        return cached as { draw: DrawDto };
      }
    }

    // 2. Perform Manual Draw inside transaction with FOR UPDATE lock on the round
    const db = getDb();
    const { result, eventId, draw } = await db.transaction(async (tx) => {
      const round = await this.drawRepo.lockRoundForDraw(roundId, tx);
      if (!round) {
        throw new NotFoundError('Round not found');
      }

      validateRoundActiveForDraw(round.status);

      const drawnQuestionIds = await this.drawRepo.getDrawnQuestionIds(roundId, tx);
      const drawnKeyIds = await this.drawRepo.getDrawnKeyIds(roundId, tx);
      const candidates = await this.drawRepo.getCandidateQuestions(roundId, tx);

      const selected = selectManualQuestion(candidates, questionId, drawnQuestionIds, drawnKeyIds);

      const lastDraw = await this.drawRepo.getLastDraw(roundId, tx);
      const sequenceNumber = computeNextDrawSequence(lastDraw?.sequenceNumber);

      const created = await this.drawRepo.create(
        {
          roundId,
          questionId: selected.id,
          keyId: selected.keyId,
          sequenceNumber,
          drawMode: 'MANUAL',
          questionText: selected.questionText,
          keyValue: selected.keyValue,
          drawnBy: actorId,
        },
        tx
      );

      await this.audit.record(
        {
          actorId,
          actorType: 'ADMIN',
          action: 'MANUAL_DRAW_CREATED',
          resourceType: 'DRAW',
          resourceId: created.id,
          metadata: {
            roundId,
            sequenceNumber,
            questionId: selected.id,
            keyId: selected.keyId,
            drawMode: 'MANUAL',
          },
        },
        tx
      );

      const res: { draw: DrawDto } = {
        draw: {
          id: created.id,
          roundId: created.roundId,
          sequenceNumber: created.sequenceNumber,
          drawMode: created.drawMode,
          questionId: created.questionId,
          keyId: created.keyId,
          questionText: created.questionText,
          keyValue: created.keyValue,
          drawnAt: created.drawnAt.toISOString(),
        },
      };

      if (this.idempotencyRepo) {
        await this.idempotencyRepo.save(key, 'DRAW', res, tx);
      }

      return { result: res, eventId: round.eventId, draw: created };
    });

    // 3. Post-commit realtime broadcast
    if (this.realtimePublisher) {
      try {
        await this.realtimePublisher.broadcastCommitted({
          type: 'DRAW_CREATED',
          eventId,
          roundId,
          occurredAt: new Date().toISOString(),
          payload: {
            sequence: draw.sequenceNumber,
            key: draw.keyValue,
            question: draw.questionText,
            drawnAt: draw.drawnAt.toISOString(),
          },
        });
      } catch (err) {
        console.error('Failed to broadcast DRAW_CREATED event after transaction commit:', err);
      }
    }

    return result;
  }

  async listDrawsForAdmin(
    roundId: string,
    options: { page?: number; limit?: number } = {}
  ): Promise<{ data: DrawDto[]; total: number; page: number; limit: number }> {
    const round = await this.roundRepo.findById(roundId);
    if (!round) {
      throw new NotFoundError('Round not found');
    }

    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(100, Math.max(1, options.limit ?? 50));

    const { data, total } = await this.drawRepo.listByRound(roundId, {
      page,
      limit,
      order: 'ASC',
    });

    return {
      data: data.map((d) => ({
        id: d.id,
        roundId: d.roundId,
        sequenceNumber: d.sequenceNumber,
        drawMode: d.drawMode,
        questionId: d.questionId,
        keyId: d.keyId,
        questionText: d.questionText,
        keyValue: d.keyValue,
        drawnAt: d.drawnAt.toISOString(),
      })),
      total,
      page,
      limit,
    };
  }

  async listDrawsForParticipant(
    userId: string,
    roundId?: string,
    options: { page?: number; limit?: number } = {}
  ): Promise<{ data: ParticipantDrawDto[]; total: number; page: number; limit: number }> {
    const db = getDb();

    // 1. Fetch Participant Profile
    const [profile] = await db
      .select({
        id: participantProfiles.id,
        eventId: participantProfiles.eventId,
        status: participantProfiles.status,
      })
      .from(participantProfiles)
      .where(eq(participantProfiles.userId, userId))
      .limit(1);

    if (!profile) {
      throw new NotFoundError('Participant profile not found');
    }

    if (profile.status !== 'ACTIVE') {
      throw new ForbiddenError('Participant account is inactive');
    }

    // 2. Resolve Target Round
    let targetRoundId: string;
    if (roundId) {
      const round = await this.roundRepo.findById(roundId);
      if (!round || round.eventId !== profile.eventId) {
        throw new NotFoundError('Round not found in event');
      }
      targetRoundId = round.id;
    } else {
      const currentRounds = await db
        .select({
          id: rounds.id,
          status: rounds.status,
          sequenceNumber: rounds.sequenceNumber,
        })
        .from(rounds)
        .where(
          and(
            eq(rounds.eventId, profile.eventId),
            inArray(rounds.status, ['ACTIVE', 'PAUSED', 'READY', 'COMPLETED'])
          )
        )
        .orderBy(desc(rounds.updatedAt));

      if (currentRounds.length === 0) {
        throw new NotFoundError('No current round found for this event');
      }

      // Prioritize ACTIVE or PAUSED, then latest
      const activeOrPaused = currentRounds.find(
        (r) => r.status === 'ACTIVE' || r.status === 'PAUSED'
      );
      targetRoundId = (activeOrPaused || currentRounds[0]!).id;
    }

    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(100, Math.max(1, options.limit ?? 50));

    // 3. Chronological draws for participant (ordered by sequence ASC)
    const { data, total } = await this.drawRepo.listByRound(targetRoundId, {
      page,
      limit,
      order: 'ASC',
    });

    // 4. Sanitize to ParticipantDrawDto (hides questionId and keyId internals if desired, exposes already drawn content)
    return {
      data: data.map((d) => ({
        id: d.id,
        roundId: d.roundId,
        sequenceNumber: d.sequenceNumber,
        drawMode: d.drawMode,
        questionText: d.questionText,
        keyValue: d.keyValue,
        drawnAt: d.drawnAt.toISOString(),
      })),
      total,
      page,
      limit,
    };
  }
}

export const drawService = new DrawService(
  drawRepository,
  roundRepository,
  auditService,
  idempotencyRepository
);
