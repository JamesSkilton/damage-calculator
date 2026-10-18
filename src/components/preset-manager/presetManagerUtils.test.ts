import { describe, expect, it } from 'vitest';
import type { UserPreset } from '../../presets/remote/types';
import {
  groupPresetsByTrainer,
  planTrainerMove,
  summarizeLibrary,
  toUpdateChanges,
  uniqueBuildName,
} from './presetManagerUtils';

function preset(overrides: Partial<UserPreset>): UserPreset {
  return {
    id: 'p',
    libraryId: 'lib',
    generation: 9,
    species: 'Abomasnow',
    buildName: 'Build',
    level: 50,
    nature: 'Hardy',
    evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
    moves: [],
    sourceFormat: 'json',
    createdAt: '',
    updatedAt: '',
    ...overrides,
  } as UserPreset;
}

describe('preset manager utils', () => {
  it('groups presets by trainer with untrained presets last', () => {
    const groups = groupPresetsByTrainer([
      preset({ id: '1', trainerName: 'Zed' }),
      preset({ id: '2' }),
      preset({ id: '3', trainerName: 'Abe' }),
      preset({ id: '4', trainerName: 'Zed' }),
    ]);
    expect(groups.map((group) => [group.trainerName, group.presets.length])).toEqual([
      ['Abe', 1],
      ['Zed', 2],
      ['', 1],
    ]);
  });

  it('orders trainers by fight index, then alphabetically', () => {
    const groups = groupPresetsByTrainer([
      preset({ id: '1', trainerName: 'Abe' }),
      preset({ id: '2', trainerName: 'Zed', index: 1 }),
      preset({ id: '3', trainerName: 'Moe', index: 2 }),
    ]);
    expect(groups.map((group) => group.trainerName)).toEqual(['Zed', 'Moe', 'Abe']);
  });

  it('plans a move by renumbering trainers and skipping unchanged presets', () => {
    const groups = groupPresetsByTrainer([
      preset({ id: '1', trainerName: 'A', index: 1 }),
      preset({ id: '2', trainerName: 'A', index: 1 }),
      preset({ id: '3', trainerName: 'B', index: 2 }),
      preset({ id: '4', trainerName: 'C' }),
    ]);
    expect(planTrainerMove(groups, 'B', -1)).toEqual([
      { id: '3', index: 1 },
      { id: '1', index: 2 },
      { id: '2', index: 2 },
      { id: '4', index: 3 },
    ]);
    expect(planTrainerMove(groups, 'A', -1)).toEqual([]);
  });

  it('summarizes trainers, Pokémon and generations', () => {
    expect(
      summarizeLibrary([
        preset({ id: '1', trainerName: 'Abe', generation: 4 }),
        preset({ id: '2', trainerName: 'abe', generation: 9 }),
        preset({ id: '3' }),
      ]),
    ).toEqual({ trainers: 1, pokemon: 3, generations: [4, 9] });
  });

  it('suffixes build names that already exist for the species', () => {
    const existing = [preset({ buildName: 'Abe' }), preset({ id: '2', buildName: 'Abe 2' })];
    expect(uniqueBuildName('Abe', 'Abomasnow', 9, existing)).toBe('Abe 3');
    expect(uniqueBuildName('Abe', 'Gyarados', 9, existing)).toBe('Abe');
  });

  it('sends cleared optional fields as null on update', () => {
    const changes = toUpdateChanges(preset({ item: 'Leftovers' })) as Record<string, unknown>;
    expect(changes.item).toBe('Leftovers');
    expect(changes.nickname).toBeNull();
    expect(changes.trainerName).toBeNull();
  });
});
