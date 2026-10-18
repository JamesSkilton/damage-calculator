import { useEffect, useMemo, useState } from 'react';
import type { BattleGeneration } from 'domain/index';
import type { ImportedPokemonSet } from '../../import/pokemonSet';
import type { PokemonPreset, PresetLibraryId } from '../../import/legacySets/legacyPresetCatalog';
import { loadKnownPresetLibraryCaches } from '../../presets/remote/presetLibraryCache';
import type { UserPresetLibraryState } from '../../presets/remote/useUserPresetLibrary';
import type { MoveOption } from '../combatant/moves/moveOptions';
import type { SpeciesOption } from '../combatant/species/speciesOptions';
import LibraryCatalog, { type CatalogEntry } from './LibraryCatalog';
import BuiltInLibraryDetail from './BuiltInLibraryDetail';
import LibraryDetail from './LibraryDetail';
import TrainerEditor from './TrainerEditor';
import { summarizeLibrary } from './presetManagerUtils';

type PresetManagerProps = {
  library: UserPresetLibraryState;
  generation: BattleGeneration;
  localSets: readonly ImportedPokemonSet[];
  onMigrated: (migratedIds: readonly string[]) => void;
  legacyPresets: readonly PokemonPreset[];
  availableSpecies: SpeciesOption[];
  availableMoves: MoveOption[];
};

type View =
  | { kind: 'catalog' }
  | { kind: 'library' }
  | { kind: 'builtin'; libraryId: PresetLibraryId }
  | { kind: 'trainer'; trainerName: string | undefined; session: number };

export default function PresetManager({
  library,
  generation,
  localSets,
  onMigrated,
  legacyPresets,
  availableSpecies,
  availableMoves,
}: PresetManagerProps) {
  const [view, setView] = useState<View>({ kind: 'catalog' });
  const [message, setMessage] = useState<string>();
  const [registryVersion, setRegistryVersion] = useState(0);
  const [session, setSession] = useState(0);

  useEffect(() => {
    const bump = () => setRegistryVersion((value) => value + 1);
    window.addEventListener('pokemans.preset-library-changed', bump);
    return () => window.removeEventListener('pokemans.preset-library-changed', bump);
  }, []);

  const entries = useMemo<CatalogEntry[]>(() => {
    const active = library.snapshot;
    const known = loadKnownPresetLibraryCaches();
    const result = known.map((entry) => {
      const isActive = entry.snapshot.library.id === active?.library.id;
      const snapshot = isActive && active ? active : entry.snapshot;
      return {
        id: snapshot.library.id,
        name: snapshot.library.name,
        stats: summarizeLibrary(snapshot.presets),
        canEdit: isActive ? library.canEdit : Boolean(entry.ownerCode),
        active: isActive,
      };
    });
    if (active && !result.some((entry) => entry.id === active.library.id)) {
      result.push({
        id: active.library.id,
        name: active.library.name,
        stats: summarizeLibrary(active.presets),
        canEdit: library.canEdit,
        active: true,
      });
    }
    return result.sort((left, right) => left.name.localeCompare(right.name));
    // registryVersion re-reads the cache registry when another save happens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [library.snapshot, library.canEdit, registryVersion]);

  const goTo = (next: View) => {
    setMessage(undefined);
    setView(next);
  };
  // Keeps the current message so "Copied …" feedback survives the jump to the editor.
  const openTrainer = (trainerName: string | undefined) => {
    setSession((current) => current + 1);
    setView({ kind: 'trainer', trainerName, session: session + 1 });
  };

  const effectiveView: View =
    (view.kind === 'library' || view.kind === 'trainer') && !library.snapshot
      ? { kind: 'catalog' }
      : view;

  return (
    <section className="card card-body d-flex flex-column gap-3" aria-labelledby="user-library-title">
      <div>
        <p className="battle-field-eyebrow mb-0">Preset libraries</p>
        <h2 id="user-library-title" className="h5 mb-0">
          {effectiveView.kind === 'catalog' ? 'Preset libraries' : 'Library'}
        </h2>
      </div>

      {library.status === 'loading' && <p className="mb-0" role="status">Loading library…</p>}
      {library.status === 'offline' && (
        <p className="mb-0 text-warning-emphasis" role="status">
          Offline — using the last cached copy.
        </p>
      )}
      {library.error && <p className="mb-0 text-danger" role="alert">{library.error}</p>}
      {message && <p className="mb-0" role="status">{message}</p>}

      {effectiveView.kind === 'catalog' && (
        <LibraryCatalog
          entries={entries}
          busy={library.busy}
          onSelect={(id) => {
            void library.switchLibrary(id);
            goTo({ kind: 'library' });
          }}
          onSelectBuiltIn={(libraryId) => goTo({ kind: 'builtin', libraryId })}
          onCreate={async (name) => {
            const ok = await library.createLibrary(name);
            if (ok) {
              goTo({ kind: 'library' });
              setMessage(`Created “${name}”. Add your first trainer to get started.`);
            }
            return ok;
          }}
          onOpenWithCode={async (code) => {
            const ok = await library.openLibrary(code);
            if (ok) goTo({ kind: 'library' });
            return ok;
          }}
        />
      )}

      {effectiveView.kind === 'builtin' && (
        <BuiltInLibraryDetail
          libraryId={effectiveView.libraryId}
          generation={generation}
          availableSpecies={availableSpecies}
          onBack={() => goTo({ kind: 'catalog' })}
        />
      )}

      {effectiveView.kind === 'library' && (
        <LibraryDetail
          library={library}
          generation={generation}
          localSets={localSets}
          legacyPresets={legacyPresets}
          availableSpecies={availableSpecies}
          onMigrated={onMigrated}
          onBack={() => goTo({ kind: 'catalog' })}
          onAddTrainer={() => openTrainer(undefined)}
          onEditTrainer={(name) => openTrainer(name)}
          onMessage={setMessage}
        />
      )}

      {effectiveView.kind === 'trainer' && (
        <TrainerEditor
          key={`${effectiveView.session}`}
          library={library}
          generation={generation}
          trainerName={effectiveView.trainerName}
          availableSpecies={availableSpecies}
          availableMoves={availableMoves}
          onBack={() => goTo({ kind: 'library' })}
          onMessage={setMessage}
        />
      )}
    </section>
  );
}
