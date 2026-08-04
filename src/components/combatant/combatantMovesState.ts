import type { BattleGeneration } from 'domain/index';
import type { MoveDraft } from './moveDraft';
import { createMoveDraft, resolveMoveDraftForGeneration } from './moveDraft';

/**
 * Attacker/defender move state at the UI level.
 * Tracks full move configuration (name + modifiers) for each slot.
 */
export interface CombatantMovesState {
  slots: readonly MoveDraft[];
}

/**
 * Create initial move state for a combatant (4 empty move slots).
 */
export function createCombatantMovesState(): CombatantMovesState {
  return {
    slots: [
      createMoveDraft(),
      createMoveDraft(),
      createMoveDraft(),
      createMoveDraft(),
    ],
  };
}

/**
 * Update a single move slot by index.
 */
export function setCombatantMoveSlot(
  state: CombatantMovesState,
  index: number,
  move: MoveDraft,
): CombatantMovesState {
  const slots = [...state.slots];
  slots[index] = move;

  return {
    ...state,
    slots: slots as readonly MoveDraft[],
  };
}

/**
 * Apply generation gating to all move slots.
 */
export function applyCombatantMovesGeneration(
  state: CombatantMovesState,
  generation: BattleGeneration,
): CombatantMovesState {
  const slots = state.slots.map((move) =>
    resolveMoveDraftForGeneration(move, generation),
  );

  return {
    ...state,
    slots: slots as readonly MoveDraft[],
  };
}

/**
 * Get active (non-empty) move names for the combatant.
 */
export function getActiveMoveNames(state: CombatantMovesState): string[] {
  return state.slots
    .map((move) => move.name.trim())
    .filter((name) => name.length > 0);
}
