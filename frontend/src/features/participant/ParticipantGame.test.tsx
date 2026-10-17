import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { QuestionCard } from './ParticipantGame';
import { TicketGrid } from './ParticipantTicket';

const animation = vi.hoisted(() => ({ revert: vi.fn(), kill: vi.fn(), fromTo: vi.fn(), timelineFromTo: vi.fn() }));
vi.mock('gsap', () => ({ gsap: {
  context: vi.fn((callback: () => void) => { callback(); return { revert: animation.revert }; }),
  timeline: vi.fn(() => ({ fromTo: animation.timelineFromTo.mockReturnThis() })),
  fromTo: animation.fromTo.mockImplementation(() => ({ kill: animation.kill })),
} }));

const draw = { roundId: 'r1', sequenceNumber: 1, questionText: 'Clue?', keyValue: 'DOCKER', drawnAt: '2026-10-17T14:00:00.000Z' };
const ticket = { id: 't1', roundId: 'r1', participantId: 'p1', eventId: 'e1', createdAt: draw.drawnAt, cells: Array.from({ length: 15 }, (_, index) => ({ id: `c${index}`, rowIndex: Math.floor(index / 5), colIndex: index % 5, row: Math.floor(index / 5), column: index % 5, keyId: `k${index}`, keyValue: index === 0 ? 'DOCKER' : `KEY ${index}`, marked: false })) };

describe('game reveal animations', () => {
  const originalMatchMedia = window.matchMedia;
  beforeEach(() => {
    animation.revert.mockClear();
    animation.kill.mockClear();
    animation.fromTo.mockClear();
    animation.timelineFromTo.mockClear();
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn().mockReturnValue({ matches: false }) });
  });
  afterEach(() => {
    cleanup();
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: originalMatchMedia });
  });

  it('cleans up the question reveal when replaced and unmounted', () => {
    const view = render(<QuestionCard draw={draw} animate />);
    expect(animation.timelineFromTo).toHaveBeenCalledTimes(2);
    view.rerender(<QuestionCard draw={{ ...draw, sequenceNumber: 2, questionText: 'New clue?' }} animate />);
    expect(animation.revert).toHaveBeenCalledOnce();
    view.unmount();
    expect(animation.revert).toHaveBeenCalledTimes(2);
  });

  it('skips both reveal and ticket hint animation when reduced motion is preferred', () => {
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn().mockReturnValue({ matches: true }) });
    const view = render(<><QuestionCard draw={draw} animate /><TicketGrid ticket={ticket} revealedKey="DOCKER" animateReveal /></>);
    expect(animation.fromTo).not.toHaveBeenCalled();
    view.unmount();
    expect(animation.revert).not.toHaveBeenCalled();
    expect(animation.kill).not.toHaveBeenCalled();
  });

  it('kills the matching ticket hint tween on unmount', () => {
    const view = render(<TicketGrid ticket={ticket} revealedKey="DOCKER" animateReveal />);
    expect(animation.fromTo).toHaveBeenCalledOnce();
    view.unmount();
    expect(animation.kill).toHaveBeenCalledOnce();
  });
});
