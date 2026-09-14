import { describe, expect, it } from 'vitest';
import {
  getLegacyPokemonPresets,
  legacyPresetData,
  normalizeLegacyPreset,
} from './legacyPresetCatalog';

describe('legacy preset catalog', () => {
  it('imports all nine checked-in generations from the legacy source data', () => {
    expect(legacyPresetData.map((entry) => entry.generation)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(legacyPresetData[0]?.sets.Venusaur?.['OU Swords Dance']).toEqual({
      moves: ['Sleep Powder', 'Razor Leaf', 'Swords Dance', 'Hyper Beam'],
    });
    expect(legacyPresetData[8]?.sets.Ivysaur?.['NFE Defensive']).toEqual({
      ability: 'Overgrow',
      item: 'Eviolite',
      nature: 'Bold',
      evs: { hp: 252, df: 252, sd: 4 },
      moves: ['Knock Off', 'Sludge Bomb', 'Giga Drain', 'Synthesis'],
    });
  });

  it('normalizes sparse Gen 1 builds with conservative defaults', () => {
    const preset = normalizeLegacyPreset(1, 'Venusaur', 'OU Swords Dance', {
      moves: ['Sleep Powder', 'Razor Leaf'],
    });

    expect(preset).toMatchObject({
      id: 'legacy-gen1-Venusaur-OU Swords Dance',
      generation: 1,
      species: 'Venusaur',
      buildName: 'OU Swords Dance',
      level: 100,
      nature: 'Serious',
      moves: ['Sleep Powder', 'Razor Leaf'],
    });
    expect(preset.gender).toBeUndefined();
    expect(preset.ivs).toEqual({ hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 });
    expect(preset.evs).toEqual({ hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 });
  });

  it('maps complete Gen 9 stat keys and preserves explicit fields', () => {
    const preset = normalizeLegacyPreset(9, 'Ivysaur', 'NFE Defensive', {
      ability: 'Overgrow',
      item: 'Eviolite',
      nature: 'Bold',
      evs: { hp: 252, df: 252, sd: 4 },
      moves: ['Knock Off', 'Sludge Bomb', 'Giga Drain', 'Synthesis'],
    });

    expect(preset).toMatchObject({
      species: 'Ivysaur',
      buildName: 'NFE Defensive',
      ability: 'Overgrow',
      item: 'Eviolite',
      nature: 'Bold',
      moves: ['Knock Off', 'Sludge Bomb', 'Giga Drain', 'Synthesis'],
    });
    expect(preset.evs).toEqual({ hp: 252, atk: 0, def: 252, spa: 0, spd: 4, spe: 0 });
  });

  it('filters by generation and available species, then sorts species and build', () => {
    const presets = getLegacyPokemonPresets(9, [
      { name: 'Ivysaur' },
      { name: 'Venusaur' },
    ]);

    expect(presets.length).toBeGreaterThan(1);
    expect(presets.every((preset) => ['Ivysaur', 'Venusaur'].includes(preset.species))).toBe(true);
    expect(presets[0]?.species).toBe('Ivysaur');
    expect(presets.find((preset) => preset.species === 'Ivysaur')?.buildName).toBe('NFE Defensive');
    expect(getLegacyPokemonPresets(0)).toEqual([]);
  });
});