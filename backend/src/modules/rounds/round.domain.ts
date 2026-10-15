import { ConflictError, ValidationError } from '../../shared/errors/app-error.ts';
import {
  PATTERN_TYPES,
  type PatternConfig,
  type PatternType,
  type RoundStatus,
} from './round.types.ts';

export function assertCanConfigureRound(currentStatus: RoundStatus): void {
  if (currentStatus !== 'DRAFT') {
    throw new ConflictError(
      `Cannot modify configuration of a round in '${currentStatus}' status. Configuration is immutable after reaching READY.`,
      'ROUND_IMMUTABLE'
    );
  }
}

export function validatePatternConfigs(patterns: PatternConfig[]): void {
  const seenTypes = new Set<PatternType>();

  for (const p of patterns) {
    if (!PATTERN_TYPES.includes(p.patternType)) {
      throw new ValidationError(`Unsupported winning pattern type: '${p.patternType}'`);
    }

    if (seenTypes.has(p.patternType)) {
      throw new ConflictError(
        `Duplicate pattern type '${p.patternType}' is not allowed in a single round.`,
        'DUPLICATE_PATTERN'
      );
    }
    seenTypes.add(p.patternType);

    if (p.enabled && (typeof p.maxWinners !== 'number' || p.maxWinners < 1)) {
      throw new ValidationError(
        `Enabled pattern '${p.patternType}' must have maxWinners >= 1`
      );
    }
  }
}

export function getDefaultPatternConfigs(): PatternConfig[] {
  return PATTERN_TYPES.map((type) => ({
    patternType: type,
    enabled: true,
    maxWinners: 1,
  }));
}
