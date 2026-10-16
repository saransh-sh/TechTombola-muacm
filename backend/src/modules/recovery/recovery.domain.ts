import { ConflictError } from '../../shared/errors/app-error.ts';

export interface RecoverySnapshot {
  drawSequences: number[];
  tickets: Array<{ id: string; cells: Array<{ keyId: string; rowIndex: number; colIndex: number }> }>;
  marks: Array<{ ticketId: string; cellTicketId: string; keyId: string }>;
  drawnKeyIds: string[];
  winnersByPattern: Array<{ patternType: string; count: number; maxWinners: number; patternStatus: 'OPEN' | 'CLOSED' }>;
  unconfiguredWinnerPatterns: string[];
  activeRoundCount: number;
}

export function validateRecoverySnapshot(snapshot: RecoverySnapshot): void {
  assertContinuousDrawSequences(snapshot.drawSequences);
  assertTicketShapes(snapshot.tickets);
  assertMarksReferenceDrawnTicketKeys(snapshot.marks, new Set(snapshot.drawnKeyIds));
  assertWinnerCapacityAndClosure(snapshot.winnersByPattern);
  if (snapshot.unconfiguredWinnerPatterns.length > 0) throw new ConflictError('Winner references an unconfigured Pattern', 'RECOVERY_WINNER_INVALID');
  if (snapshot.activeRoundCount > 0) throw new ConflictError('Another Round is already active', 'RECOVERY_MULTIPLE_ACTIVE_ROUNDS');
}

export function assertContinuousDrawSequences(sequences: number[]): void {
  for (let index = 0; index < sequences.length; index += 1) {
    if (sequences[index] !== index + 1) throw new ConflictError('Draw sequences must be continuous and start at one', 'RECOVERY_DRAW_SEQUENCE_INVALID');
  }
}

export function assertTicketShapes(tickets: RecoverySnapshot['tickets']): void {
  for (const ticket of tickets) {
    const cells = ticket.cells;
    const rowCounts = [0, 1, 2].map((rowIndex) => cells.filter((cell) => cell.rowIndex === rowIndex).length);
    const hasInvalidCoordinates = cells.some((cell) => cell.rowIndex < 0 || cell.rowIndex > 2 || cell.colIndex < 0 || cell.colIndex > 8);
    const hasDuplicatePositions = new Set(cells.map((cell) => `${cell.rowIndex}:${cell.colIndex}`)).size !== cells.length;
    if (cells.length !== 15 || new Set(cells.map((cell) => cell.keyId)).size !== 15 || hasInvalidCoordinates || hasDuplicatePositions || rowCounts.some((count) => count !== 5)) {
      throw new ConflictError('Ticket must have a valid 3×9 layout with fifteen distinct keys and five per row', 'RECOVERY_TICKET_INVALID');
    }
  }
}

export function assertMarksReferenceDrawnTicketKeys(marks: RecoverySnapshot['marks'], drawnKeyIds: Set<string>): void {
  for (const mark of marks) {
    if (mark.ticketId !== mark.cellTicketId || !drawnKeyIds.has(mark.keyId)) throw new ConflictError('Mark does not belong to its Ticket or references an undrawn Key', 'RECOVERY_MARK_INVALID');
  }
}

export function assertWinnerCapacityAndClosure(patterns: RecoverySnapshot['winnersByPattern']): void {
  for (const pattern of patterns) {
    if (pattern.count > pattern.maxWinners || (pattern.count >= pattern.maxWinners && pattern.patternStatus !== 'CLOSED') || (pattern.patternStatus === 'CLOSED' && pattern.count < pattern.maxWinners)) {
      throw new ConflictError('Winner capacity or Pattern closure is inconsistent', 'RECOVERY_WINNER_INVALID');
    }
  }
}

export function assertClaimWinnerConsistency(inconsistent: boolean): void {
  if (inconsistent) throw new ConflictError('Claim and verified Winner records do not agree', 'RECOVERY_CLAIM_INVALID');
}
