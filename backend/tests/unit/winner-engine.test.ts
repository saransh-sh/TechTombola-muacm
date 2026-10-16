import { describe, expect, it } from 'bun:test';
import {
  evaluatePattern,
  isEarly5,
  isLineCompleted,
  isFullHouse,
  validatePatternEligibility,
  validateRoundActiveForClaim,
  type TicketCellEvaluationInput,
} from '../../src/modules/claims/winner.domain.ts';
import { ConflictError, UnprocessableEntityError } from '../../src/shared/errors/index.ts';

describe('Winner Evaluation and Pattern Domain Logic (Pure Unit Tests)', () => {
  // Construct a standard 15-cell ticket (3 rows x 5 cells)
  // Row 0: k0_0, k0_1, k0_2, k0_3, k0_4
  // Row 1: k1_0, k1_1, k1_2, k1_3, k1_4
  // Row 2: k2_0, k2_1, k2_2, k2_3, k2_4
  const sampleTicketCells: TicketCellEvaluationInput[] = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 5; c++) {
      sampleTicketCells.push({
        rowIndex: r,
        colIndex: c,
        keyId: `k${r}_${c}`,
      });
    }
  }

  describe('isEarly5', () => {
    it('returns false when fewer than 5 ticket keys are drawn', () => {
      // 4 keys drawn
      const drawn = new Set(['k0_0', 'k0_1', 'k0_2', 'k0_3']);
      expect(isEarly5(sampleTicketCells, drawn)).toBe(false);
    });

    it('returns true when exactly 5 ticket keys are drawn', () => {
      // 5 keys drawn across different rows
      const drawn = new Set(['k0_0', 'k0_1', 'k1_0', 'k2_0', 'k2_4']);
      expect(isEarly5(sampleTicketCells, drawn)).toBe(true);
    });

    it('returns true when more than 5 ticket keys are drawn (6 draws)', () => {
      const drawn = new Set(['k0_0', 'k0_1', 'k0_2', 'k1_0', 'k2_0', 'k2_4']);
      expect(isEarly5(sampleTicketCells, drawn)).toBe(true);
    });

    it('ignores drawn keys that do not belong to the ticket', () => {
      // 3 ticket keys + 10 unrelated keys
      const drawn = new Set(['k0_0', 'k0_1', 'k0_2', 'unrelated_1', 'unrelated_2', 'unrelated_3']);
      expect(isEarly5(sampleTicketCells, drawn)).toBe(false);
    });
  });

  describe('isLineCompleted (TOP_LINE, MIDDLE_LINE, BOTTOM_LINE)', () => {
    it('returns true when all 5 keys in Row 0 (Top Line) are drawn', () => {
      const drawn = new Set(['k0_0', 'k0_1', 'k0_2', 'k0_3', 'k0_4']);
      expect(isLineCompleted(sampleTicketCells, 0, drawn)).toBe(true);
    });

    it('returns false when only 4 of 5 keys in Row 0 are drawn', () => {
      const drawn = new Set(['k0_0', 'k0_1', 'k0_2', 'k0_3']);
      expect(isLineCompleted(sampleTicketCells, 0, drawn)).toBe(false);
    });

    it('returns true for Middle Line (Row 1) when all 5 row 1 keys are drawn', () => {
      const drawn = new Set(['k1_0', 'k1_1', 'k1_2', 'k1_3', 'k1_4', 'other_key']);
      expect(isLineCompleted(sampleTicketCells, 1, drawn)).toBe(true);
      expect(isLineCompleted(sampleTicketCells, 0, drawn)).toBe(false);
      expect(isLineCompleted(sampleTicketCells, 2, drawn)).toBe(false);
    });

    it('returns true for Bottom Line (Row 2) when all 5 row 2 keys are drawn', () => {
      const drawn = new Set(['k2_0', 'k2_1', 'k2_2', 'k2_3', 'k2_4']);
      expect(isLineCompleted(sampleTicketCells, 2, drawn)).toBe(true);
      expect(isLineCompleted(sampleTicketCells, 0, drawn)).toBe(false);
      expect(isLineCompleted(sampleTicketCells, 1, drawn)).toBe(false);
    });
  });

  describe('isFullHouse', () => {
    it('returns false when 14 of 15 ticket keys are drawn', () => {
      const drawn = new Set(sampleTicketCells.slice(0, 14).map((c) => c.keyId));
      expect(isFullHouse(sampleTicketCells, drawn)).toBe(false);
    });

    it('returns true when all 15 ticket keys are drawn', () => {
      const drawn = new Set(sampleTicketCells.map((c) => c.keyId));
      expect(isFullHouse(sampleTicketCells, drawn)).toBe(true);
    });

    it('returns true when all 15 ticket keys plus extra drawn keys are present', () => {
      const drawn = new Set([...sampleTicketCells.map((c) => c.keyId), 'extra_draw_1', 'extra_draw_2']);
      expect(isFullHouse(sampleTicketCells, drawn)).toBe(true);
    });
  });

  describe('evaluatePattern', () => {
    it('dispatches properly to each supported pattern', () => {
      const early5Drawn = new Set(['k0_0', 'k0_1', 'k0_2', 'k0_3', 'k0_4']);
      expect(evaluatePattern('EARLY_5', sampleTicketCells, early5Drawn)).toBe(true);
      expect(evaluatePattern('TOP_LINE', sampleTicketCells, early5Drawn)).toBe(true);
      expect(evaluatePattern('MIDDLE_LINE', sampleTicketCells, early5Drawn)).toBe(false);
      expect(evaluatePattern('BOTTOM_LINE', sampleTicketCells, early5Drawn)).toBe(false);
      expect(evaluatePattern('FULL_HOUSE', sampleTicketCells, early5Drawn)).toBe(false);
    });

    it('throws ConflictError on unknown pattern type', () => {
      expect(() =>
        evaluatePattern('FOUR_CORNERS' as any, sampleTicketCells, new Set())
      ).toThrow(ConflictError);
    });
  });

  describe('validatePatternEligibility', () => {
    it('accepts enabled and OPEN pattern', () => {
      expect(() =>
        validatePatternEligibility({ enabled: true, status: 'OPEN' })
      ).not.toThrow();
    });

    it('throws ConflictError with PATTERN_DISABLED when pattern is disabled', () => {
      expect(() =>
        validatePatternEligibility({ enabled: false, status: 'OPEN' })
      ).toThrow(ConflictError);
      try {
        validatePatternEligibility({ enabled: false, status: 'OPEN' });
      } catch (err: any) {
        expect(err.code).toBe('PATTERN_DISABLED');
      }
    });

    it('throws ConflictError with PATTERN_CLOSED when pattern is closed', () => {
      expect(() =>
        validatePatternEligibility({ enabled: true, status: 'CLOSED' })
      ).toThrow(ConflictError);
      try {
        validatePatternEligibility({ enabled: true, status: 'CLOSED' });
      } catch (err: any) {
        expect(err.code).toBe('PATTERN_CLOSED');
      }
    });
  });

  describe('validateRoundActiveForClaim', () => {
    it('accepts ACTIVE round status', () => {
      expect(() => validateRoundActiveForClaim('ACTIVE')).not.toThrow();
    });

    it('rejects non-ACTIVE statuses with ConflictError ROUND_NOT_ACTIVE', () => {
      const invalid = ['DRAFT', 'READY', 'PAUSED', 'COMPLETED', 'CANCELLED'];
      for (const s of invalid) {
        expect(() => validateRoundActiveForClaim(s)).toThrow(ConflictError);
        try {
          validateRoundActiveForClaim(s);
        } catch (err: any) {
          expect(err.code).toBe('ROUND_NOT_ACTIVE');
        }
      }
    });
  });
});
