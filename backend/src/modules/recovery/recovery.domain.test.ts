import { describe, expect, it } from 'bun:test';
import { validateRecoverySnapshot } from './recovery.domain.ts';

function snapshot() {
  return {
    drawSequences: [1, 2],
    tickets: [{ id: 'ticket', cells: Array.from({ length: 15 }, (_, index) => ({ keyId: `key-${index}`, rowIndex: Math.floor(index / 5), colIndex: index % 5 })) }],
    marks: [{ ticketId: 'ticket', cellTicketId: 'ticket', keyId: 'key-0' }],
    drawnKeyIds: ['key-0', 'key-1'],
    winnersByPattern: [{ patternType: 'EARLY_5', count: 1, maxWinners: 1, patternStatus: 'CLOSED' as const }],
    unconfiguredWinnerPatterns: [],
    activeRoundCount: 0,
  };
}

describe('recovery consistency validation', () => {
  it('accepts a consistent persisted Round snapshot', () => { expect(() => validateRecoverySnapshot(snapshot())).not.toThrow(); });
  it('rejects a gap in Draw sequences', () => { expect(() => validateRecoverySnapshot({ ...snapshot(), drawSequences: [1, 3] })).toThrow('Draw sequences'); });
  it('rejects duplicate Draw sequence numbers', () => { expect(() => validateRecoverySnapshot({ ...snapshot(), drawSequences: [1, 1] })).toThrow('Draw sequences'); });
  it('rejects a malformed Ticket', () => { expect(() => validateRecoverySnapshot({ ...snapshot(), tickets: [{ id: 'ticket', cells: [] }] })).toThrow('Ticket'); });
  it('rejects a Mark for an undrawn Key', () => { expect(() => validateRecoverySnapshot({ ...snapshot(), marks: [{ ticketId: 'ticket', cellTicketId: 'ticket', keyId: 'future' }] })).toThrow('Mark'); });
  it('rejects a Mark whose cell belongs to another Ticket', () => { expect(() => validateRecoverySnapshot({ ...snapshot(), marks: [{ ticketId: 'ticket', cellTicketId: 'other-ticket', keyId: 'key-0' }] })).toThrow('Mark'); });
  it('rejects an over-capacity Winner Pattern', () => { expect(() => validateRecoverySnapshot({ ...snapshot(), winnersByPattern: [{ patternType: 'EARLY_5', count: 2, maxWinners: 1, patternStatus: 'CLOSED' as const }] })).toThrow('Winner'); });
  it('rejects a Winner for an unconfigured Pattern', () => { expect(() => validateRecoverySnapshot({ ...snapshot(), unconfiguredWinnerPatterns: ['UNKNOWN_PATTERN'] })).toThrow('unconfigured Pattern'); });
  it('rejects a closed Pattern below its configured capacity', () => { expect(() => validateRecoverySnapshot({ ...snapshot(), winnersByPattern: [{ patternType: 'EARLY_5', count: 0, maxWinners: 1, patternStatus: 'CLOSED' as const }] })).toThrow('Winner'); });
  it('rejects conflicting active Rounds', () => { expect(() => validateRecoverySnapshot({ ...snapshot(), activeRoundCount: 1 })).toThrow('Another Round'); });
});
