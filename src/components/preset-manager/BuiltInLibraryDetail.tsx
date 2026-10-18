import { useMemo, useState } from 'react';
import type { BattleGeneration } from 'domain/index';
import { presetLibraries, type PresetLibraryId } from '../../import/legacySets/legacyPresetCatalog';
import PresetSummaryTable from './PresetSummaryTable';
import { builtInHasTrainers, groupBuiltInPresets, summarizeBuiltInLibrary } from './builtInLibraries';

type BuiltInLibraryDetailProps = {
  libraryId: PresetLibraryId;
  generation: BattleGeneration;
  availableSpecies?: readonly { name: string }[];
  onBack: () => void;
};

const PAGE_SIZE = 25;

export default function BuiltInLibraryDetail({
  libraryId,
  generation,
  availableSpecies,
  onBack,
}: BuiltInLibraryDetailProps) {
  const [search, setSearch] = useState('');
  const [visible, setVisible] = useState(PAGE_SIZE);
  const library = presetLibraries.find((entry) => entry.id === libraryId);
  const hasTrainers = builtInHasTrainers(libraryId);

  const stats = useMemo(() => (library ? summarizeBuiltInLibrary(library) : undefined), [library]);
  const groups = useMemo(
    () => groupBuiltInPresets(libraryId, generation, availableSpecies),
    [availableSpecies, generation, libraryId],
  );
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return groups;
    return groups.filter(
      (group) =>
        group.label.toLowerCase().includes(term) ||
        group.presets.some((preset) => preset.species.toLowerCase().includes(term)),
    );
  }, [groups, search]);

  if (!library || !stats) return null;
  const pokemonCount = groups.reduce((total, group) => total + group.presets.length, 0);

  return (
    <div className="d-flex flex-column gap-3">
      <div>
        <button className="btn btn-sm btn-outline-secondary" type="button" onClick={onBack}>
          ← All libraries
        </button>
      </div>

      <div>
        <h3 className="h5 mb-1">
          {library.label} <span className="badge text-bg-secondary align-middle">Built-in · Read-only</span>
        </h3>
        <div className="small text-body-secondary">
          {stats.groups} {stats.groupLabel.toLowerCase()} · {stats.pokemon} Pokémon · Gen{' '}
          {stats.generations.join(', ')}
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="card card-body text-center text-body-secondary">
          {library.label} has no sets for Gen {generation}. Switch generation to Gen{' '}
          {stats.generations.join(', ')} to browse it.
        </div>
      ) : (
        <>
          <input
            className="form-control form-control-sm"
            aria-label="Search built-in trainers and Pokémon"
            placeholder={`Search Gen ${generation} ${hasTrainers ? 'trainers' : 'species'} or Pokémon`}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setVisible(PAGE_SIZE);
            }}
          />
          <div className="small text-body-secondary">
            Showing Gen {generation}: {filtered.length} of {groups.length} {stats.groupLabel.toLowerCase()},{' '}
            {pokemonCount} Pokémon.
          </div>

          {filtered.length === 0 ? (
            <div className="card card-body text-center text-body-secondary">Nothing matches your search.</div>
          ) : (
            <div className="d-flex flex-column gap-3">
              {filtered.slice(0, visible).map((group) => (
                <section className="card" key={group.key} aria-label={group.label}>
                  <div className="card-header">
                    <strong>{group.label}</strong>
                    <span className="text-body-secondary"> · {group.presets.length} Pokémon</span>
                  </div>
                  <PresetSummaryTable presets={group.presets} showBuildName={!hasTrainers} />
                </section>
              ))}
            </div>
          )}
          {filtered.length > visible && (
            <button
              className="btn btn-outline-secondary btn-sm align-self-center"
              type="button"
              onClick={() => setVisible((current) => current + PAGE_SIZE)}
            >
              Show more ({filtered.length - visible} remaining)
            </button>
          )}
        </>
      )}
    </div>
  );
}
