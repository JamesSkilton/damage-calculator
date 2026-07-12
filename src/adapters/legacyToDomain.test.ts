import { describe, expect, it } from 'vitest';
import {
  mapLegacyFieldToBattleField,
  mapLegacySideToBattleSide,
  mapLegacyMoveToBattleMove,
  mapLegacyPokemonToBattleCombatant,
  type LegacyMoveData,
  type LegacySpeciesData,
  type LegacyGeneration,
} from '@/adapters/legacyToDomain';

const generation: LegacyGeneration<LegacySpeciesData, LegacyMoveData> = {
  num: 2,
  species: {
    get(id) {
      if (id === 'pikachu') {
        return {
          name: 'Pikachu',
          types: ['Electric'] as const,
          weightkg: 6,
          gender: 'M',
          abilities: { 0: 'Static' },
          baseStats: { hp: 35, atk: 55, def: 40, spa: 50, spd: 50, spe: 90 },
        };
      }

      if (id === 'mrmime') {
        return {
          name: 'Mr. Mime',
          types: ['Psychic', 'Fairy'] as const,
          weightkg: 54.5,
          gender: 'N',
          abilities: { 0: 'Filter' },
          baseStats: { hp: 40, atk: 45, def: 65, spa: 100, spd: 120, spe: 90 },
        };
      }

      return undefined;
    },
  },
  moves: {
    get(id) {
      if (id === 'rollout') {
        return {
          id: 'rollout',
          name: 'Rollout',
          basePower: 30,
          type: 'Rock',
          category: 'Physical',
          flags: {},
          multihit: [2, 5],
          priority: 0,
        };
      }

      if (id === 'thunderbolt') {
        return {
          id: 'thunderbolt',
          name: 'Thunderbolt',
          basePower: 90,
          type: 'Electric',
          category: 'Special',
          flags: {},
          priority: 0,
          isZ: true,
          zMove: { basePower: 175 },
        };
      }

      if (id === '10000000voltthunderbolt') {
        return {
          id: '10000000voltthunderbolt',
          name: '10,000,000 Volt Thunderbolt',
          basePower: 1,
          type: 'Electric',
          category: 'Special',
          flags: {},
          priority: 0,
          isZ: true,
        };
      }

      return undefined;
    },
  },
};

const generation7: LegacyGeneration<LegacySpeciesData, LegacyMoveData> = {
  ...generation,
  num: 7,
};

describe('legacy domain mappers', () => {
  it('maps pokemon state with legacy defaults and stat normalization', () => {
    const combatant = mapLegacyPokemonToBattleCombatant(generation, {
      name: 'Mr. Mime',
      ivs: { spc: 20 },
      evs: {},
      boosts: { spc: 2 },
      originalCurHP: 50,
      status: 'par',
      moves: ['Thunderbolt'],
    });

    expect(combatant).toMatchObject({
      generation: 2,
      name: 'Mr. Mime',
      species: 'Mr. Mime',
      level: 100,
      gender: 'N',
      ability: 'Filter',
      nature: 'Serious',
      currentHp: 50,
      status: 'par',
      toxicCounter: 0,
      abilityOn: false,
      isDynamaxed: false,
      moves: ['Thunderbolt'],
    });

    expect(combatant.ivs).toEqual({
      hp: 31,
      atk: 31,
      def: 31,
      spa: 20,
      spd: 20,
      spe: 31,
    });

    expect(combatant.evs).toEqual({
      hp: 252,
      atk: 252,
      def: 252,
      spa: 252,
      spd: 252,
      spe: 252,
    });

    expect(combatant.boosts).toEqual({
      hp: 0,
      atk: 0,
      def: 0,
      spa: 2,
      spd: 2,
      spe: 0,
    });
  });

  it('throws when gen 1/2 special stats do not match', () => {
    expect(() =>
      mapLegacyPokemonToBattleCombatant(generation, {
        name: 'Pikachu',
        ivs: { spa: 10, spd: 9 },
      }),
    ).toThrow(
      'Special Attack and Special Defense must match in Gen 1 and Gen 2',
    );
  });

  it('throws when gen 1/2 boost stats do not match', () => {
    expect(() =>
      mapLegacyPokemonToBattleCombatant(generation, {
        name: 'Pikachu',
        boosts: { spa: 2, spd: 1 },
      }),
    ).toThrow(
      'Special Attack and Special Defense must match in Gen 1 and Gen 2',
    );
  });

  it('maps move state with legacy counters and transform defaults', () => {
    const move = mapLegacyMoveToBattleMove(generation7, {
      name: 'Thunderbolt',
      useZ: true,
      isCrit: false,
      isStellarFirstUse: true,
      timesUsed: 3,
      timesUsedWithMetronome: 2,
      item: 'Pikashunium Z',
    });

    expect(move).toMatchObject({
      generation: 7,
      name: '10,000,000 Volt Thunderbolt',
      basePower: 175,
      type: 'Electric',
      category: 'Special',
      target: 'any',
      priority: 0,
      hits: 1,
      isStellarFirstUse: true,
      timesUsed: 3,
      timesUsedWithMetronome: 2,
      isZ: true,
      isMax: false,
      multiaccuracy: false,
    });
  });

  it('maps field and side state defaults', () => {
    expect(mapLegacySideToBattleSide({ isTailwind: true, spikes: 2 })).toEqual({
      spikes: 2,
      steelsurge: false,
      vinelash: false,
      wildfire: false,
      cannonade: false,
      volcalith: false,
      isSR: false,
      isReflect: false,
      isLightScreen: false,
      isProtected: false,
      isSeeded: false,
      isSaltCured: false,
      isForesight: false,
      isTailwind: true,
      isHelpingHand: false,
      isFlowerGift: false,
      isPowerTrick: false,
      isFriendGuard: false,
      isAuroraVeil: false,
      isBattery: false,
      isPowerSpot: false,
      isSteelySpirit: false,
      isSwitching: undefined,
    });

    const field = mapLegacyFieldToBattleField(9, {
      gameType: 'Singles',
      attackerSide: {},
      defenderSide: { isTailwind: true, spikes: 2 },
    });

    expect(field).toMatchObject({
      generation: 9,
      gameType: 'Singles',
      isMagicRoom: false,
      isWonderRoom: false,
      isGravity: false,
      isAuraBreak: false,
      isFairyAura: false,
      isDarkAura: false,
      isBeadsOfRuin: false,
      isSwordOfRuin: false,
      isTabletsOfRuin: false,
      isVesselOfRuin: false,
    });

    expect(field.attackerSide).toEqual({
      spikes: 0,
      steelsurge: false,
      vinelash: false,
      wildfire: false,
      cannonade: false,
      volcalith: false,
      isSR: false,
      isReflect: false,
      isLightScreen: false,
      isProtected: false,
      isSeeded: false,
      isSaltCured: false,
      isForesight: false,
      isTailwind: false,
      isHelpingHand: false,
      isFlowerGift: false,
      isPowerTrick: false,
      isFriendGuard: false,
      isAuroraVeil: false,
      isBattery: false,
      isPowerSpot: false,
      isSteelySpirit: false,
      isSwitching: undefined,
    });

    expect(field.defenderSide).toEqual({
      spikes: 2,
      steelsurge: false,
      vinelash: false,
      wildfire: false,
      cannonade: false,
      volcalith: false,
      isSR: false,
      isReflect: false,
      isLightScreen: false,
      isProtected: false,
      isSeeded: false,
      isSaltCured: false,
      isForesight: false,
      isTailwind: true,
      isHelpingHand: false,
      isFlowerGift: false,
      isPowerTrick: false,
      isFriendGuard: false,
      isAuroraVeil: false,
      isBattery: false,
      isPowerSpot: false,
      isSteelySpirit: false,
      isSwitching: undefined,
    });
  });
});
