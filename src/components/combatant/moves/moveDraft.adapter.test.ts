import { describe, expect, it } from 'vitest';
import { mapLegacyMoveToBattleMove } from 'adapters/legacyMove';
import { createMoveDraft, toMoveLegacyInput } from './moveDraft';
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
          maxMove: { basePower: 130 },
        },
        maxquake: {
          name: 'Max Quake',
          basePower: 10,
          type: 'Ground',
          category: 'Physical',
          flags: {},
          priority: 0,
          isMax: true,
        },
        thunderbolt: {
          name: 'Thunderbolt',
          basePower: 90,
          type: 'Electric',
          category: 'Special',
          flags: {},
          priority: 0,
          zMove: { basePower: 175 },
        },
        gigavolthavoc: {
          name: 'Gigavolt Havoc',
          basePower: 1,
          type: 'Electric',
          category: 'Special',
          flags: {},
          priority: 0,
          isZ: true,
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
    it('preserves the selected move payload through the Z-move bridge', () => {
      const draft = createMoveDraft('Thunderbolt', {
        isCrit: true,
        hits: 2,
        useZ: true,
        isStellarFirstUse: true,
        timesUsed: 3,
        timesUsedWithMetronome: 2,
      });

      const legacyInput = toMoveLegacyInput(draft);
      const battleMove = mapLegacyMoveToBattleMove(mockGen9, legacyInput);

      expect(legacyInput).toEqual({
        name: 'Thunderbolt',
        isCrit: true,
        hits: 2,
        useZ: true,
        useMax: false,
        isStellarFirstUse: true,
        timesUsed: 3,
        timesUsedWithMetronome: 2,
      });
      expect(battleMove).toMatchObject({
        generation: 9,
        name: 'Gigavolt Havoc',
        basePower: 175,
        type: 'Electric',
        category: 'Special',
        hits: 2,
        isCrit: true,
        isZ: true,
        isMax: false,
        isStellarFirstUse: true,
        timesUsed: 3,
        timesUsedWithMetronome: 2,
      });
    });

    it('preserves the selected move payload through the Max-move bridge', () => {
      const draft = createMoveDraft('Earthquake', {
        isCrit: false,
        hits: 1,
        useMax: true,
        timesUsed: 4,
        timesUsedWithMetronome: 1,
      });

      const legacyInput = toMoveLegacyInput(draft);
      const battleMove = mapLegacyMoveToBattleMove(mockGen9, legacyInput);

      expect(legacyInput).toEqual({
        name: 'Earthquake',
        isCrit: false,
        hits: 1,
        useZ: false,
        useMax: true,
        isStellarFirstUse: false,
        timesUsed: 4,
        timesUsedWithMetronome: 1,
      });
      expect(battleMove).toMatchObject({
        generation: 9,
        name: 'Max Quake',
        basePower: 130,
        type: 'Ground',
        category: 'Physical',
        hits: 1,
        isCrit: false,
        isZ: false,
        isMax: true,
        isStellarFirstUse: false,
        timesUsed: 4,
        timesUsedWithMetronome: 1,
      });
    });

    it('maps move draft through legacy input to battle move', () => {
      const draft = createMoveDraft('Earthquake', {
        isCrit: true,
        hits: 1,
      });

      const legacyInput = toMoveLegacyInput(draft);
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
