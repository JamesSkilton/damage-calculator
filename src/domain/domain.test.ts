/**
 * Compile-time assignability checks for the phase-2 battle domain types.
 * These tests have no runtime assertions — a type error here is a failing test.
 */
import { describe, it } from 'vitest';
import type { BattleCombatant } from 'domain/combatant';
import type { BattleMove } from 'domain/move';

describe('BattleMove type', () => {
  it('accepts isStellarFirstUse, timesUsed, and timesUsedWithMetronome', () => {
    const move = {
      generation: 9,
      name: 'Tera Blast',
      basePower: 80,
      type: 'Normal',
      category: 'Special',
      flags: {},
      target: 'normal',
      priority: 0,
      hits: 1,
      isCrit: false,
      isZ: false,
      isMax: false,
      isStellarFirstUse: true,
      timesUsed: 1,
      timesUsedWithMetronome: 3,
      hasCrashDamage: false,
      mindBlownRecoil: false,
      struggleRecoil: false,
      breaksProtect: false,
      ignoreDefensive: false,
      multiaccuracy: false,
    } satisfies BattleMove;

    // timesUsedWithMetronome is optional
    const moveNoMetronome = {
      ...move,
      timesUsedWithMetronome: undefined,
    } satisfies BattleMove;

    void move;
    void moveNoMetronome;
  });
});

describe('BattleCombatant type', () => {
  const baseStats = {
    hp: 100,
    atk: 100,
    def: 100,
    spa: 100,
    spd: 100,
    spe: 100,
  } as const;

  it('accepts abilityOn, isDynamaxed, and dynamaxLevel', () => {
    const dynamaxed = {
      generation: 8,
      name: 'Charizard-Gmax',
      species: 'Charizard-Gmax',
      level: 50,
      nature: 'Timid',
      types: ['Fire', 'Flying'],
      ivs: baseStats,
      evs: baseStats,
      boosts: {},
      currentHp: 200,
      toxicCounter: 0,
      abilityOn: false,
      isDynamaxed: true,
      dynamaxLevel: 10,
      moves: ['Max Flare'],
    } satisfies BattleCombatant;

    // dynamaxLevel is optional (absent when not dynamaxed)
    const normal = {
      generation: 9,
      name: 'Pikachu',
      species: 'Pikachu',
      level: 50,
      nature: 'Jolly',
      types: ['Electric'],
      ivs: baseStats,
      evs: baseStats,
      boosts: {},
      currentHp: 95,
      toxicCounter: 0,
      abilityOn: false,
      isDynamaxed: false,
      moves: ['Thunderbolt'],
    } satisfies BattleCombatant;

    // abilityOn: true (e.g. Flash Fire activated)
    const flashFireActive = {
      ...normal,
      abilityOn: true,
      ability: 'Flash Fire',
    } satisfies BattleCombatant;

    void dynamaxed;
    void normal;
    void flashFireActive;
  });
});
