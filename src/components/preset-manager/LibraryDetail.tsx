import { useMemo, useState } from 'react';
import type { BattleGeneration } from 'domain/index';
import type { ImportedPokemonSet } from '../../import/pokemonSet';
import type { PokemonPreset } from '../../import/legacySets/legacyPresetCatalog';
import type { UserPresetLibraryState } from '../../presets/remote/useUserPresetLibrary';
import LibraryTools from './LibraryTools';
import PresetSummaryTable from './PresetSummaryTable';
import { NO_TRAINER_LABEL, groupPresetsByTrainer, planTrainerMove, summarizeLibrary } from './presetManagerUtils';

type LibraryDetailProps = {
  library: UserPresetLibraryState;
  generation: BattleGeneration;
  localSets: readonly ImportedPokemonSet[];
  legacyPresets: readonly PokemonPreset[];
  onMigrated: (migratedIds: readonly string[]) => void;
  onBack: () => void;
  onAddTrainer: () => void;
  onEditTrainer: (trainerName: string) => void;
  onMessage: (message: string | undefined) => void;
};

export default function LibraryDetail({
  library,
  generation,
  localSets,
  legacyPresets,
  onMigrated,
  onBack,
  onAddTrainer,
  onEditTrainer,
  onMessage,
}: LibraryDetailProps) {
  const [search, setSearch] = useState('');
  const snapshot = library.snapshot;

  const stats = useMemo(() => summarizeLibrary(library.presets), [library.presets]);
  const generationPresets = useMemo(
    () => library.presets.filter((preset) => preset.generation === generation),
    [generation, library.presets],
  );
  const allGroups = useMemo(() => groupPresetsByTrainer(generationPresets), [generationPresets]);
  const groups = useMemo(() => {
    const term = search.trim().toLowerCase();
    return allGroups.filter(
      (group) =>
        !term ||
        group.trainerName.toLowerCase().includes(term) ||
        group.presets.some(
          (preset) =>
            preset.species.toLowerCase().includes(term) || (preset.nickname ?? '').toLowerCase().includes(term),
        ),
    );
  }, [allGroups, search]);
  const canReorder = library.canEdit && search.trim() === '';

  if (!snapshot) return null;

  const copy = (value: string | undefined) => {
    if (value) void navigator.clipboard?.writeText(value);
  };

  const moveTrainer = async (trainerName: string, direction: -1 | 1) => {
    const order = planTrainerMove(allGroups, trainerName, direction);
    if (order.length > 0 && (await library.reorderPresets(order))) {
      onMessage(`Moved ${trainerName}. Fight order updated.`);
    }
  };

  const removeTrainer = async (trainerName: string, ids: readonly string[]) => {
    const label = trainerName || NO_TRAINER_LABEL;
    if (!window.confirm(`Delete ${label} and their ${ids.length} Pokémon from this library?`)) return;
    for (const id of ids) {
      if (!(await library.deletePreset(id))) return;
    }
    onMessage(`Deleted ${label}.`);
  };

  return (
    <div className="d-flex flex-column gap-3">
      <div>
        <button className="btn btn-sm btn-outline-secondary" type="button" onClick={onBack}>
          ← All libraries
        </button>
      </div>

      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2">
        <div>
          <h3 className="h5 mb-1">{snapshot.library.name}</h3>
          <div className="small text-body-secondary">
            {stats.trainers} trainer(s) · {stats.pokemon} Pokémon · Gen{' '}
            {stats.generations.join(', ') || '—'} · {library.canEdit ? 'Owner access' : 'Read-only'} · Revision{' '}
            {snapshot.library.revision}
          </div>
        </div>
        {library.canEdit && (
          <button className="btn btn-primary btn-sm" type="button" onClick={onAddTrainer}>
            Add trainer
          </button>
        )}
      </div>

      <div className="d-flex flex-wrap gap-2 align-items-center">
        <input
          className="form-control form-control-sm w-auto flex-grow-1"
          aria-label="Search trainers and Pokémon"
          placeholder={`Search Gen ${generation} trainers or Pokémon`}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <button className="btn btn-sm btn-outline-secondary" type="button" onClick={() => void library.refresh()}>
          Refresh
        </button>
      </div>

      <div className="small text-body-secondary">
        Showing Gen {generation}: {groups.length} trainer group(s), {generationPresets.length} Pokémon
        {generationPresets.length < library.presets.length &&
          ` (${library.presets.length - generationPresets.length} more in other generations)`}
        .
      </div>

      {groups.length === 0 ? (
        <div className="card card-body text-center text-body-secondary">
          {generationPresets.length === 0
            ? `No trainers in Gen ${generation} yet.`
            : 'No trainers match your search.'}
          {library.canEdit && generationPresets.length === 0 && (
            <div className="mt-2">
              <button className="btn btn-primary btn-sm" type="button" onClick={onAddTrainer}>
                Add your first trainer
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="d-flex flex-column gap-3">
          {groups.map((group) => (
            <section className="card" key={group.trainerName || '__none__'} aria-label={group.trainerName || NO_TRAINER_LABEL}>
              <div className="card-header d-flex justify-content-between align-items-center gap-2">
                <span>
                  {group.trainerName && (
                    <span className="badge text-bg-secondary me-2">
                      Fight {group.presets[0].index ?? '—'}
                    </span>
                  )}
                  <strong>{group.trainerName || NO_TRAINER_LABEL}</strong>
                  <span className="text-body-secondary"> · {group.presets.length} Pokémon</span>
                </span>
                {library.canEdit && (
                  <span className="d-inline-flex gap-2">
                    {group.trainerName && (
                      <span className="btn-group btn-group-sm" role="group" aria-label={`Reorder ${group.trainerName}`}>
                        <button
                          className="btn btn-outline-secondary"
                          type="button"
                          disabled={!canReorder || library.busy || allGroups[0] === group}
                          title={canReorder ? 'Fight earlier' : 'Clear the search to reorder'}
                          aria-label={`Move ${group.trainerName} up`}
                          onClick={() => void moveTrainer(group.trainerName, -1)}
                        >
                          ↑
                        </button>
                        <button
                          className="btn btn-outline-secondary"
                          type="button"
                          disabled={
                            !canReorder ||
                            library.busy ||
                            allGroups.filter((entry) => entry.trainerName !== '').at(-1) === group
                          }
                          title={canReorder ? 'Fight later' : 'Clear the search to reorder'}
                          aria-label={`Move ${group.trainerName} down`}
                          onClick={() => void moveTrainer(group.trainerName, 1)}
                        >
                          ↓
                        </button>
                      </span>
                    )}
                    <button
                      className="btn btn-sm btn-outline-primary"
                      type="button"
                      aria-label={`Edit ${group.trainerName || NO_TRAINER_LABEL}`}
                      onClick={() => onEditTrainer(group.trainerName)}
                    >
                      Edit trainer
                    </button>
                    <button
                      className="btn btn-sm btn-outline-danger"
                      type="button"
                      disabled={library.busy}
                      aria-label={`Delete ${group.trainerName || NO_TRAINER_LABEL}`}
                      onClick={() => void removeTrainer(group.trainerName, group.presets.map((preset) => preset.id))}
                    >
                      Delete
                    </button>
                  </span>
                )}
              </div>
              <PresetSummaryTable presets={group.presets} />
            </section>
          ))}
        </div>
      )}

      <details className="border rounded p-3">
        <summary className="fw-semibold">Sharing &amp; access</summary>
        <div className="d-flex flex-wrap gap-2 mt-2">
          {library.readCode && (
            <button className="btn btn-sm btn-outline-secondary" type="button" onClick={() => copy(library.readCode)}>
              Copy read code
            </button>
          )}
          {library.ownerCode && (
            <button className="btn btn-sm btn-outline-secondary" type="button" onClick={() => copy(library.ownerCode)}>
              Copy owner code
            </button>
          )}
          {library.canEdit && (
            <button
              className="btn btn-sm btn-outline-danger"
              type="button"
              disabled={library.busy}
              onClick={() => {
                if (window.confirm('Rotate codes? The old read and owner codes will stop working.')) {
                  void library.rotateCodes();
                }
              }}
            >
              Rotate codes
            </button>
          )}
        </div>
      </details>

      <details className="border rounded p-3">
        <summary className="fw-semibold">Import, export &amp; built-in sets</summary>
        <div className="mt-3">
          <LibraryTools
            library={library}
            generation={generation}
            localSets={localSets}
            legacyPresets={legacyPresets}
            onMigrated={onMigrated}
            onMessage={onMessage}
            onTrainerCopied={onEditTrainer}
          />
        </div>
      </details>
    </div>
  );
}
