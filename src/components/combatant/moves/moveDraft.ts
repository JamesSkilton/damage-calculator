import type { BattleGeneration } from 'domain/index';

export interface MoveDraft {
  name: string;
  isCrit: boolean;
  hits: number;
  useZ: boolean;
  useMax: boolean;
  isStellarFirstUse: boolean;
  timesUsed: number;
  timesUsedWithMetronome?: number;
}

export interface MoveSlot {
  index: number;
  move: MoveDraft;
}

const MIN_HITS = 1;
const MAX_HITS = 8;
const MIN_TIMES_USED = 1;
const MAX_TIMES_USED = 255;

export function createMoveDraft(
  name: string = '',
  overrides?: Partial<MoveDraft>,
): MoveDraft {
  return {
    name: name.trim(),
    isCrit: false,
    hits: 1,
    useZ: false,
    useMax: false,
    isStellarFirstUse: false,
    timesUsed: 1,
    timesUsedWithMetronome: undefined,
    ...overrides,
  };
}

export function updateMoveDraft(
  draft: MoveDraft,
  updates: Partial<MoveDraft>,
): MoveDraft {
  return {
    ...draft,
    ...updates,
  };
}

export function setMoveName(draft: MoveDraft, name: string): MoveDraft {
  return {
    ...draft,
    name: name.trim(),
  };
}

export function setMoveCrit(draft: MoveDraft, isCrit: boolean): MoveDraft {
  return {
    ...draft,
    isCrit,
  };
}

export function setMoveHits(
  draft: MoveDraft,
  hits: number | string,
): MoveDraft {
  const parsed = typeof hits === 'string' ? parseInt(hits, 10) : hits;

  if (!Number.isFinite(parsed)) {
    return draft;
  }

  const clamped = Math.max(MIN_HITS, Math.min(MAX_HITS, Math.trunc(parsed)));

  return {
    ...draft,
    hits: clamped,
  };
}

export function setMoveZ(draft: MoveDraft, useZ: boolean): MoveDraft {
  return {
    ...draft,
    useZ,
    useMax: useZ ? false : draft.useMax,
  };
}

export function setMoveMax(draft: MoveDraft, useMax: boolean): MoveDraft {
  return {
    ...draft,
    useMax,
    useZ: useMax ? false : draft.useZ,
  };
}

export function setMoveStellar(
  draft: MoveDraft,
  isStellarFirstUse: boolean,
): MoveDraft {
  return {
    ...draft,
    isStellarFirstUse,
  };
}

export function setMoveTimesUsed(
  draft: MoveDraft,
  timesUsed: number | string,
): MoveDraft {
  const parsed =
    typeof timesUsed === 'string' ? parseInt(timesUsed, 10) : timesUsed;

  if (!Number.isFinite(parsed)) {
    return draft;
  }

  const clamped = Math.max(
    MIN_TIMES_USED,
    Math.min(MAX_TIMES_USED, Math.trunc(parsed)),
  );

  return {
    ...draft,
    timesUsed: clamped,
  };
}

export function setMoveTimesUsedWithMetronome(
  draft: MoveDraft,
  timesUsedWithMetronome: number | string | undefined,
): MoveDraft {
  if (timesUsedWithMetronome === undefined || timesUsedWithMetronome === '') {
    return {
      ...draft,
      timesUsedWithMetronome: undefined,
    };
  }

  const parsed =
    typeof timesUsedWithMetronome === 'string'
      ? parseInt(timesUsedWithMetronome, 10)
      : timesUsedWithMetronome;

  if (!Number.isFinite(parsed)) {
    return draft;
  }

  const clamped = Math.max(0, Math.min(MAX_TIMES_USED, Math.trunc(parsed)));

  return {
    ...draft,
    timesUsedWithMetronome: clamped > 0 ? clamped : undefined,
  };
}

export function isGenerationGated(
  moveType: 'z' | 'max' | 'stellar',
  generation: BattleGeneration,
): boolean {
  if (moveType === 'z') {
    return generation >= 7;
  }

  if (moveType === 'max') {
    return generation >= 8;
  }

  if (moveType === 'stellar') {
    return generation >= 9;
  }

  return false;
}

export function validateMoveDraft(draft: MoveDraft): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!draft.name || draft.name.trim() === '') {
    errors.push('Move name is required');
  }

  if (draft.hits < MIN_HITS || draft.hits > MAX_HITS) {
    errors.push(`Hits must be between ${MIN_HITS} and ${MAX_HITS}`);
  }

  if (draft.timesUsed < MIN_TIMES_USED || draft.timesUsed > MAX_TIMES_USED) {
    errors.push(
      `Times used must be between ${MIN_TIMES_USED} and ${MAX_TIMES_USED}`,
    );
  }

  if (
    draft.timesUsedWithMetronome !== undefined &&
    (draft.timesUsedWithMetronome < 0 ||
      draft.timesUsedWithMetronome > MAX_TIMES_USED)
  ) {
    errors.push(
      `Times used with metronome must be between 0 and ${MAX_TIMES_USED}`,
    );
  }

  if (draft.useZ && draft.useMax) {
    errors.push('Move cannot be both Z and Max');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function resolveMoveDraftForGeneration(
  draft: MoveDraft,
  generation: BattleGeneration,
): MoveDraft {
  let resolved = { ...draft };

  if (!isGenerationGated('z', generation) && resolved.useZ) {
    resolved = { ...resolved, useZ: false };
  }

  if (!isGenerationGated('max', generation) && resolved.useMax) {
    resolved = { ...resolved, useMax: false };
  }

  if (!isGenerationGated('stellar', generation) && resolved.isStellarFirstUse) {
    resolved = { ...resolved, isStellarFirstUse: false };
  }

  return resolved;
}

export function toMoveSlot(index: number, move: MoveDraft): MoveSlot {
  return { index, move };
}

/**
 * Convert a move draft to LegacyMoveInput for adapter boundary.
 */
export function toMoveLegacyInput(move: MoveDraft) {
  return {
    name: move.name,
    isCrit: move.isCrit,
    hits: move.hits,
    useZ: move.useZ,
    useMax: move.useMax,
    isStellarFirstUse: move.isStellarFirstUse,
    timesUsed: move.timesUsed,
    timesUsedWithMetronome: move.timesUsedWithMetronome,
  };
}
