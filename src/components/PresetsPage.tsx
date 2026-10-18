import { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { AppShellContext } from './AppShell';
import { buildSpeciesCatalog } from './combatant/species/speciesCatalog';
import { buildMoveCatalog } from './combatant/moves/moveCatalog';
import { loadImportedPokemonSets, removeImportedPokemonSet } from '../import/pokemonSetStorage';
import { getPokemonPresets } from '../import/legacySets/legacyPresetCatalog';
import { runtimeConfig } from '../config/runtimeConfig';
import { createHttpPresetLibraryRepository } from '../presets/remote/httpRepository';
import { useUserPresetLibrary } from '../presets/remote/useUserPresetLibrary';
import PresetManager from './preset-manager/PresetManager';

export default function PresetsPage() {
  const { generation, presetLibraryId } = useOutletContext<AppShellContext>();
  const [localSets, setLocalSets] = useState(() => loadImportedPokemonSets());
  const repository = useMemo(
    () =>
      runtimeConfig.presetApiUrl
        ? createHttpPresetLibraryRepository(runtimeConfig.presetApiUrl)
        : undefined,
    [],
  );
  const library = useUserPresetLibrary(repository);
  const availableSpecies = useMemo(
    () => buildSpeciesCatalog(generation),
    [generation],
  );
  const legacyPresets = useMemo(
    () => getPokemonPresets(presetLibraryId, generation, availableSpecies),
    [availableSpecies, generation, presetLibraryId],
  );
  const availableMoves = useMemo(
    () => buildMoveCatalog(generation),
    [generation],
  );

  if (!repository) {
    return (
      <section className="card card-body">
        <h2 className="h4">Preset manager</h2>
        <p className="mb-0">
          The preset service is not configured. Set <code>VITE_PRESET_API_URL</code> and restart the app.
        </p>
      </section>
    );
  }

  return (
    <section className="d-flex flex-column gap-3">
      <div>
        <p className="eyebrow mb-1">Library management</p>
        <h2 className="h3 mb-1">Preset manager</h2>
        <p className="text-body-secondary mb-0">
          Browse your preset libraries, then manage each library’s trainers and their Pokémon.
        </p>
      </div>
      <PresetManager
        library={library}
        generation={generation}
        localSets={localSets}
        onMigrated={(ids) => {
          ids.forEach((id) => removeImportedPokemonSet(id));
          setLocalSets(loadImportedPokemonSets());
        }}
        legacyPresets={legacyPresets}
        availableSpecies={availableSpecies}
        availableMoves={availableMoves}
      />
    </section>
  );
}
