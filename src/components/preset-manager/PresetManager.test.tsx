import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { UserPreset } from '../../presets/remote/types';
import type { UserPresetLibraryState } from '../../presets/remote/useUserPresetLibrary';
import LibraryCatalog from './LibraryCatalog';
import BuiltInLibraryDetail from './BuiltInLibraryDetail';
import LibraryDetail from './LibraryDetail';

function preset(id: string, trainerName: string | undefined, species: string): UserPreset {
  return {
    id,
    libraryId: 'lib',
    generation: 9,
    species,
    buildName: `${trainerName} ${species}`,
    trainerName,
    level: 42,
    item: 'Leftovers',
    nature: 'Modest',
    evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
    moves: ['Blizzard', 'Surf'],
    sourceFormat: 'json',
    createdAt: '',
    updatedAt: '',
  } as UserPreset;
}

const presets = [
  preset('1', 'Roxanne', 'Geodude'),
  preset('2', 'Roxanne', 'Nosepass'),
  preset('3', 'Brawly', 'Makuhita'),
];

const library = {
  status: 'ready',
  snapshot: {
    library: { id: 'lib', name: 'Emerald', createdAt: '', updatedAt: '', revision: 3, presetCount: 3 },
    presets,
  },
  presets,
  baseStats: [],
  canEdit: true,
  busy: false,
  refresh: vi.fn(),
} as unknown as UserPresetLibraryState;

describe('preset manager views', () => {
  it('shows each library with trainer and Pokémon counts', () => {
    const markup = renderToStaticMarkup(
      <LibraryCatalog
        entries={[
          { id: 'lib', name: 'Emerald', stats: { trainers: 2, pokemon: 3, generations: [9] }, canEdit: true, active: true },
        ]}
        busy={false}
        onSelect={vi.fn()}
        onSelectBuiltIn={vi.fn()}
        onCreate={vi.fn()}
        onOpenWithCode={vi.fn()}
      />,
    );
    expect(markup).toContain('Emerald');
    expect(markup).toContain('Trainers');
    expect(markup).toContain('Owner');
    expect(markup).toContain('Built-in libraries');
    expect(markup).toContain('Run &amp; Bun');
    expect(markup).toContain('Radical Red');
  });

  it('renders a built-in library read-only, grouped by trainer', () => {
    const markup = renderToStaticMarkup(
      <BuiltInLibraryDetail libraryId="run-and-bun" generation={9} onBack={vi.fn()} />,
    );
    expect(markup).toContain('Built-in · Read-only');
    expect(markup).not.toContain('Edit trainer');
    expect(markup).toContain('Show more');
  });

  it('lists trainers with their Pokémon, level, item, nature and moves', () => {
    const markup = renderToStaticMarkup(
      <LibraryDetail
        library={library}
        generation={9}
        localSets={[]}
        legacyPresets={[]}
        availableSpecies={[]}
        onMigrated={vi.fn()}
        onBack={vi.fn()}
        onAddTrainer={vi.fn()}
        onEditTrainer={vi.fn()}
        onMessage={vi.fn()}
      />,
    );
    expect(markup).toContain('Roxanne');
    expect(markup).toContain('Brawly');
    expect(markup).toContain('Nosepass');
    expect(markup).toContain('Leftovers');
    expect(markup).toContain('Modest');
    expect(markup).toContain('Blizzard');
    expect(markup).toContain('Add trainer');
    expect(markup).toContain('Base stats (0 override(s) in Gen 9)');
  });
});
