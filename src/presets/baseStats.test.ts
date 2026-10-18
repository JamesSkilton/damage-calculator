import { describe, expect, it } from 'vitest';
import {
  mergeBaseStatEntries,
  parseBaseStatsUpload,
  validateBaseStatEntries,
  type SpeciesBaseStats,
} from './baseStats';
import { calculateBattleRuntime } from 'calc-runtime';
import { createTeamDraft } from '../components/combatant/shared/combatantDraft';
import { createBattleFieldDraft } from '../components/combatant/shared/battleFieldDraft';

const DEFAULTS = { hp: 35, atk: 55, def: 40, spa: 50, spd: 50, spe: 90 };
const resolve = (name: string) =>
  name.toLowerCase() === 'pikachu' ? { name: 'Pikachu', baseStats: DEFAULTS } : undefined;

describe('parseBaseStatsUpload', () => {
  it('fills omitted stats from the species default and normalizes the name', () => {
    const result = parseBaseStatsUpload(
      JSON.stringify({ generation: 9, baseStats: [{ species: 'pikachu', baseStats: { spe: 120 } }] }),
      9,
      resolve,
    );
    expect(result.errors).toEqual([]);
    expect(result.entries).toEqual([
      { generation: 9, species: 'Pikachu', baseStats: { ...DEFAULTS, spe: 120 } },
    ]);
  });

  it('reports unknown species, bad values and generation mismatches', () => {
    const bad = parseBaseStatsUpload(
      JSON.stringify([{ species: 'Missingno', baseStats: {} }, { species: 'Pikachu', baseStats: { hp: 999 } }]),
      9,
      resolve,
    );
    expect(bad.entries).toEqual([]);
    expect(bad.errors).toHaveLength(2);
    expect(parseBaseStatsUpload(JSON.stringify({ generation: 8, baseStats: [] }), 9, resolve).errors[0]).toMatch(
      /Gen 8/,
    );
  });

  it('requires matching special stats in Gen 1', () => {
    const result = parseBaseStatsUpload(
      JSON.stringify([{ species: 'Pikachu', baseStats: { spa: 60 } }]),
      1,
      resolve,
    );
    expect(result.errors[0]).toMatch(/Gen 1 and Gen 2/);
  });
});

describe('validateBaseStatEntries', () => {
  it('rejects partial stats and duplicates', () => {
    expect(validateBaseStatEntries([{ generation: 9, species: 'Pikachu', baseStats: { hp: 1 } }]).messages).not.toEqual([]);
    const entry = { generation: 9, species: 'Pikachu', baseStats: DEFAULTS };
    expect(validateBaseStatEntries([entry, entry]).messages.join(' ')).toMatch(/more than once/);
    expect(validateBaseStatEntries([entry]).messages).toEqual([]);
  });
});

describe('mergeBaseStatEntries', () => {
  it('replaces entries for the same generation and species', () => {
    const existing: SpeciesBaseStats[] = [{ generation: 9, species: 'Pikachu', baseStats: DEFAULTS }];
    const merged = mergeBaseStatEntries(existing, [
      { generation: 9, species: 'pikachu', baseStats: { ...DEFAULTS, hp: 100 } },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].baseStats.hp).toBe(100);
  });
});

describe('combatant base stat override', () => {
  it('changes the calculated damage', () => {
    const { attacker, defender } = createTeamDraft(9);
    const run = (baseStats?: SpeciesBaseStats['baseStats']) =>
      calculateBattleRuntime({
        generation: 9,
        attacker: { ...attacker, species: 'Pikachu', name: 'Pikachu', moves: ['Tackle'], baseStats },
        defender: { ...defender, species: 'Pikachu', name: 'Pikachu' },
        move: {
          generation: 9,
          name: 'Tackle',
          basePower: 40,
          type: 'Normal',
          category: 'Physical',
          flags: {},
          target: 'normal',
          priority: 0,
          hits: 1,
          isCrit: false,
          isZ: false,
          isMax: false,
          isStellarFirstUse: false,
          timesUsed: 1,
          hasCrashDamage: false,
          mindBlownRecoil: false,
          struggleRecoil: false,
          breaksProtect: false,
          ignoreDefensive: false,
          multiaccuracy: false,
        },
        field: createBattleFieldDraft(9),
      });
    const base = run().range()[1];
    expect(run({ ...DEFAULTS, atk: 255 }).range()[1]).toBeGreaterThan(base);
  });
});
