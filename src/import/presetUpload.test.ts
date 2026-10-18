import { describe, expect, it } from 'vitest';
import { detectUploadFormat, parseUpload } from './presetUpload';

const json = (presets: unknown[], extra: object = {}) =>
  JSON.stringify({ schemaVersion: 1, generation: 9, presets, ...extra });

const venusaur = {
  species: 'Venusaur',
  buildName: 'Sun Sweeper',
  level: 100,
  nature: 'Timid',
  evs: { spa: 252, spe: 252, hp: 4 },
  ivs: { hp: 31 },
  moves: ['Growth', 'Giga Drain', 'Sludge Bomb', 'Weather Ball'],
};

describe('presetUpload', () => {
  it('detects formats', () => {
    expect(detectUploadFormat('  {"a":1}')).toBe('json');
    expect(detectUploadFormat('Pikachu\n- Thunderbolt')).toBe('showdown');
  });

  it('parses valid json presets', () => {
    const preview = parseUpload(
      json([{ ...venusaur, trainerName: 'Leader Erika', sourcePresetId: 'legacy-id' }]),
      9,
    );
    expect(preview.errors).toEqual([]);
    expect(preview.presets).toHaveLength(1);
    expect(preview.presets[0]).toMatchObject({
      species: 'Venusaur',
      buildName: 'Sun Sweeper',
      nature: 'Timid',
      sourceFormat: 'json',
      trainerName: 'Leader Erika',
      sourcePresetId: 'legacy-id',
    });
    expect(preview.presets[0].evs.spa).toBe(252);
  });

  it('reports per-record errors in mixed batches', () => {
    const preview = parseUpload(
      json([venusaur, { species: 'Notamon', moves: [] }, { ...venusaur, buildName: 'B', evs: { atk: 999 } }]),
      9,
    );
    expect(preview.presets).toHaveLength(1);
    expect(preview.errors.map((entry) => entry.index)).toEqual([1, 2]);
  });

  it('rejects wrong schema version and bad json', () => {
    expect(parseUpload('{"schemaVersion":2,"presets":[]}', 9).errors).toHaveLength(1);
    expect(parseUpload('{oops', 9).errors[0].messages[0]).toBe('Invalid JSON.');
  });

  it('parses showdown text per set and flags invalid sets', () => {
    const text = 'Pikachu @ Light Ball\nAbility: Static\nEVs: 252 SpA / 252 Spe\nTimid Nature\n- Thunderbolt\n\nFakemon\n- Tackle';
    const preview = parseUpload(text, 9);
    expect(preview.presets).toHaveLength(1);
    expect(preview.errors).toHaveLength(1);
    expect(preview.errors[0].index).toBe(1);
  });

  it('detects duplicates in the upload and against existing presets', () => {
    const preview = parseUpload(json([venusaur, venusaur]), 9);
    expect(preview.presets).toHaveLength(1);
    expect(preview.duplicates).toHaveLength(1);
    const against = parseUpload(json([venusaur]), 9, [
      { generation: 9, species: 'Venusaur', buildName: 'Sun Sweeper' },
    ]);
    expect(against.presets).toHaveLength(0);
    expect(against.duplicates).toHaveLength(1);
  });

  it('rejects EV totals above 510', () => {
    const preview = parseUpload(json([{ ...venusaur, evs: { hp: 252, atk: 252, def: 252 } }]), 9);
    expect(preview.errors[0].messages.join(' ')).toMatch(/510/);
  });

  it('preserves individual IV values from JSON', () => {
    const preview = parseUpload(
      json([{ ...venusaur, ivs: { hp: 31, atk: 0, def: 12, spa: 30, spd: 31, spe: 1 } }]),
      9,
    );
    expect(preview.errors).toEqual([]);
    expect(preview.presets[0].ivs).toMatchObject({
      hp: 31,
      atk: 0,
      def: 12,
      spa: 30,
      spd: 31,
      spe: 1,
    });
  });
});
