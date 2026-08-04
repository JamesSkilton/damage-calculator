import { describe, expect, it } from 'vitest';
import { mapLegacyMoveToBattleMove } from 'adapters/legacyMove';
import { toMoveLegacyInput } from 'components/combatant/moveDraft';
import { createMoveDraft } from 'components/combatant/moveDraft';
import type { LegacyGeneration } from 'adapters/legacyShared';
import type { LegacyMoveData } from 'adapters/legacyMove.types';

// Mock legacy generation data for testing
const mockGen9: LegacyGeneration<unknown, LegacyMoveData> = {
  num: 9,
  species: {
    get: () => undefined,
  },
  moves: {
    get: (id: string) => {
      const moves: Record<string, LegacyMoveData> = {
        earthquake: {
          name: 'Earthquake',
          basePower: 100,
          type: 'Ground',
          category: 'Physical',
          flags: { contact: 1 },
          priority: 0,
        },
        thunderbolt: {
          name: 'Thunderbolt',
          basePower: 90,
          type: 'Electric',
          category: 'Special',
          flags: {},
          priority: 0,
        },
      };
      return moves[id];
    },
  },
};

describe('Move Draft Adapter Integration', () => {
  describe('toMoveLegacyInput', () => {
    it('converts move draft to legacy input format', () => {
      const draft = createMoveDraft('Earthquake', {
        isCrit: true,
        hits: 1,
        useZ: false,
        useMax: false,
        timesUsed: 1,
      });

      const legacyInput = toMoveLegacyInput(draft);

      expect(legacyInput).toEqual({
        name: 'Earthquake',
        isCrit: true,
        hits: 1,
        useZ: false,
        useMax: false,
        isStellarFirstUse: false,
        timesUsed: 1,
        timesUsedWithMetronome: undefined,
      });
    });

    it('preserves all move state in legacy input', () => {
      const draft = createMoveDraft('Earthquake', {
        isCrit: true,
        hits: 2,
        useZ: false,
        useMax: false,
        isStellarFirstUse: false,
        timesUsed: 3,
        timesUsedWithMetronome: 2,
      });

      const legacyInput = toMoveLegacyInput(draft);

      expect(legacyInput.isCrit).toBe(true);
      expect(legacyInput.hits).toBe(2);
      expect(legacyInput.timesUsed).toBe(3);
      expect(legacyInput.timesUsedWithMetronome).toBe(2);
    });
  });

  describe('Move Draft to Battle Move mapping', () => {
    it('maps move draft through legacy input to battle move', () => {
      const draft = createMoveDraft('Earthquake', {
        isCrit: true,
        hits: 1,
      });

      const legacyInput = toMoveLegacyInput(draft);

      // Map through legacy adapter
      const battleMove = mapLegacyMoveToBattleMove(mockGen9, legacyInput);

      expect(battleMove.name).toBe('Earthquake');
      expect(battleMove.basePower).toBe(100);
      expect(battleMove.type).toBe('Ground');
      expect(battleMove.isCrit).toBe(true);
      expect(battleMove.hits).toBe(1);
      expect(battleMove.generation).toBe(9);
    });

    it('preserves move state through adapter mapping', () => {
      const draft = createMoveDraft('Earthquake', {
        isCrit: false,
        hits: 1,
        timesUsed: 2,
      });

      const legacyInput = toMoveLegacyInput(draft);
      const battleMove = mapLegacyMoveToBattleMove(mockGen9, legacyInput);

      expect(battleMove.isCrit).toBe(false);
      expect(battleMove.timesUsed).toBe(2);
    });

    it('handles multiple move types', () => {
      const draft = createMoveDraft('Thunderbolt', {
        isCrit: false,
      });

      const legacyInput = toMoveLegacyInput(draft);
      const battleMove = mapLegacyMoveToBattleMove(mockGen9, legacyInput);

      expect(battleMove.name).toBe('Thunderbolt');
      expect(battleMove.type).toBe('Electric');
      expect(battleMove.category).toBe('Special');
      expect(battleMove.basePower).toBe(90);
    });
  });
});
