import { describe, expect, it } from 'vitest';
import {
  createCombatantMovesState,
  setCombatantMoveSlot,
  applyCombatantMovesGeneration,
  getActiveMoveNames,
} from './combatantMovesState';
import { createMoveDraft } from './moveDraft';

describe('combatantMovesState', () => {
  describe('createCombatantMovesState', () => {
    it('creates 4 empty move slots', () => {
      const state = createCombatantMovesState();
      expect(state.slots).toHaveLength(4);
      expect(state.slots.every((move) => move.name === '')).toBe(true);
    });
  });

  describe('setCombatantMoveSlot', () => {
    it('updates move at given index', () => {
      const state = createCombatantMovesState();
      const newMove = createMoveDraft('Earthquake', { isCrit: true });
      const updated = setCombatantMoveSlot(state, 0, newMove);

      expect(updated.slots[0].name).toBe('Earthquake');
      expect(updated.slots[0].isCrit).toBe(true);
      expect(updated.slots[1].name).toBe('');
    });

    it('does not mutate original state', () => {
      const state = createCombatantMovesState();
      const newMove = createMoveDraft('Thunderbolt');
      const updated = setCombatantMoveSlot(state, 1, newMove);

      expect(state.slots[1].name).toBe('');
      expect(updated.slots[1].name).toBe('Thunderbolt');
    });
  });

  describe('applyCombatantMovesGeneration', () => {
    it('clears incompatible move modifiers for generation', () => {
      const state = createCombatantMovesState();
      const withZ = setCombatantMoveSlot(
        state,
        0,
        createMoveDraft('Earthquake', { useZ: true }),
      );

      const gen6State = applyCombatantMovesGeneration(withZ, 6);
      expect(gen6State.slots[0].useZ).toBe(false);

      const gen7State = applyCombatantMovesGeneration(withZ, 7);
      expect(gen7State.slots[0].useZ).toBe(true);
    });
  });

  describe('getActiveMoveNames', () => {
    it('returns non-empty move names', () => {
      let state = createCombatantMovesState();
      state = setCombatantMoveSlot(state, 0, createMoveDraft('Earthquake'));
      state = setCombatantMoveSlot(state, 1, createMoveDraft('Thunderbolt'));
      state = setCombatantMoveSlot(state, 3, createMoveDraft('Swords Dance'));

      const names = getActiveMoveNames(state);
      expect(names).toEqual(['Earthquake', 'Thunderbolt', 'Swords Dance']);
    });

    it('returns empty array when no moves set', () => {
      const state = createCombatantMovesState();
      const names = getActiveMoveNames(state);
      expect(names).toHaveLength(0);
    });
  });
});
