import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import DefenderPresetRoster from './DefenderPresetRoster';
import type { PresetTrainerGroup } from '../../import/legacySets/legacyPresetCatalog';

const groups: PresetTrainerGroup[] = [
  {
    trainerName: 'Leader Falkner',
    presets: [
      {
        id: 'radical-red-gen9-Rufflet-Leader Falkner',
        generation: 9,
        species: 'Rufflet',
        buildName: 'Leader Falkner',
        level: 12,
        ability: 'Hustle',
        item: 'Berry Juice',
        nature: 'Jolly',
        evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
        ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
        moves: ['Aerial Ace', 'Roost'],
      },
    ],
  },
];

describe('DefenderPresetRoster', () => {
  it('renders the active trainer and its selectable Pokemon', () => {
    const markup = renderToStaticMarkup(
      <DefenderPresetRoster
        groups={groups}
        availableSpecies={[{ name: 'Rufflet', types: ['Flying'] }]}
        activeTrainerName="Leader Falkner"
        selectedPresetId={groups[0].presets[0].id}
        onSelect={() => undefined}
      />,
    );

    expect(markup).toContain('Defender trainer roster');
    expect(markup).toContain('Leader Falkner');
    expect(markup).toContain('Rufflet');
    expect(markup).toContain('Aerial Ace');
    expect(markup).toContain('Berry Juice');
    expect(markup).toContain('aria-label="Flying"');
    expect(markup).toContain('aria-pressed="true"');
  });
});