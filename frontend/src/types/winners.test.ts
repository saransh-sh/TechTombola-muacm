import { describe, expect, it } from 'vitest';
import { participantWinSchema } from './winners';

const win = { id: 'winner-1', claimId: 'claim-1', participantId: 'participant-1', roundId: 'round-1', eventId: 'event-1', patternType: 'EARLY_5', verifiedAt: '2026-10-18T12:00:00.000Z' };

describe('participant winning cell evidence', () => {
  it('accepts backend-selected cell IDs without requiring a client-side pattern calculation', () => {
    expect(participantWinSchema.parse({ ...win, eligibleCellIds: ['cell-1', 'cell-2'] }).eligibleCellIds).toEqual(['cell-1', 'cell-2']);
  });

  it('accepts existing Winner responses that have no cell evidence yet', () => {
    expect(participantWinSchema.parse(win).eligibleCellIds).toBeUndefined();
  });

  it('rejects empty or malformed cell evidence rather than highlighting it', () => {
    expect(participantWinSchema.safeParse({ ...win, eligibleCellIds: [''] }).success).toBe(false);
    expect(participantWinSchema.safeParse({ ...win, eligibleCellIds: 'cell-1' }).success).toBe(false);
  });
});
