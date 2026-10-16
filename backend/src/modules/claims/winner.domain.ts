import { ConflictError, UnprocessableEntityError } from '../../shared/errors/index.ts';

export type WinningPatternType =
  | 'EARLY_5'
  | 'TOP_LINE'
  | 'MIDDLE_LINE'
  | 'BOTTOM_LINE'
  | 'FULL_HOUSE';

export interface TicketCellEvaluationInput {
  rowIndex: number;
  colIndex: number;
  keyId: string;
}

/**
 * Early 5 is satisfied when at least five Keys on the assigned Ticket
 * have been officially drawn.
 */
export function isEarly5(
  cells: TicketCellEvaluationInput[],
  drawnKeyIds: Set<string>
): boolean {
  const drawnCount = cells.filter((c) => drawnKeyIds.has(c.keyId)).length;
  return drawnCount >= 5;
}

/**
 * A line is completed when all populated cells in that line (row)
 * have been officially drawn.
 */
export function isLineCompleted(
  cells: TicketCellEvaluationInput[],
  rowIndex: number,
  drawnKeyIds: Set<string>
): boolean {
  const rowCells = cells.filter((c) => c.rowIndex === rowIndex);
  if (rowCells.length === 0) return false;
  return rowCells.every((c) => drawnKeyIds.has(c.keyId));
}

/**
 * Full House is satisfied when all 15 populated keys on the ticket
 * have been officially drawn.
 */
export function isFullHouse(
  cells: TicketCellEvaluationInput[],
  drawnKeyIds: Set<string>
): boolean {
  if (cells.length === 0) return false;
  return cells.every((c) => drawnKeyIds.has(c.keyId));
}

/**
 * Evaluate a given pattern against the ticket's cells and the drawn keys.
 */
export function evaluatePattern(
  patternType: WinningPatternType,
  cells: TicketCellEvaluationInput[],
  drawnKeyIds: Set<string>
): boolean {
  switch (patternType) {
    case 'EARLY_5':
      return isEarly5(cells, drawnKeyIds);
    case 'TOP_LINE':
      return isLineCompleted(cells, 0, drawnKeyIds);
    case 'MIDDLE_LINE':
      return isLineCompleted(cells, 1, drawnKeyIds);
    case 'BOTTOM_LINE':
      return isLineCompleted(cells, 2, drawnKeyIds);
    case 'FULL_HOUSE':
      return isFullHouse(cells, drawnKeyIds);
    default:
      throw new ConflictError(`Unknown pattern type: ${patternType}`, 'UNKNOWN_PATTERN');
  }
}

/**
 * Validates that the pattern is enabled and OPEN.
 */
export function validatePatternEligibility(patternConfig: {
  enabled: boolean;
  status: string;
}): void {
  if (!patternConfig.enabled) {
    throw new ConflictError('Pattern is disabled for this round', 'PATTERN_DISABLED');
  }
  if (patternConfig.status !== 'OPEN') {
    throw new ConflictError('Pattern is already closed for this round', 'PATTERN_CLOSED');
  }
}

/**
 * Validates that the round is in ACTIVE status.
 */
export function validateRoundActiveForClaim(status: string): void {
  if (status !== 'ACTIVE') {
    throw new ConflictError(
      `Round must be in ACTIVE status to submit a claim. Current status is ${status}.`,
      'ROUND_NOT_ACTIVE'
    );
  }
}
