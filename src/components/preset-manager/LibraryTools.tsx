import { useMemo, useState, type DragEvent } from 'react';
import type { BattleGeneration } from 'domain/index';
import type { ImportedPokemonSet } from '../../import/pokemonSet';
import { parseUpload, serializePresetsAsJson, type UploadPreset } from '../../import/presetUpload';
import { serializePokemonSet } from '../../import/pokemonSetSerializer';
import type { PokemonPreset } from '../../import/legacySets/legacyPresetCatalog';
import type { UserPresetLibraryState } from '../../presets/remote/useUserPresetLibrary';
import { localToUpload, nextTrainerIndex, toInput } from './presetManagerUtils';

type LibraryToolsProps = {
  library: UserPresetLibraryState;
  generation: BattleGeneration;
  localSets: readonly ImportedPokemonSet[];
  legacyPresets: readonly PokemonPreset[];
  onMigrated: (migratedIds: readonly string[]) => void;
  onMessage: (message: string | undefined) => void;
  onTrainerCopied: (trainerName: string) => void;
};

const BUILT_IN_RESULT_LIMIT = 10;

export default function LibraryTools({
  library,
  generation,
  localSets,
  legacyPresets,
  onMigrated,
  onMessage,
  onTrainerCopied,
}: LibraryToolsProps) {
  const [uploadText, setUploadText] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [showMigration, setShowMigration] = useState(false);
  const [exportText, setExportText] = useState('');
  const [builtInSearch, setBuiltInSearch] = useState('');

  const existing = library.presets;
  const preview = useMemo(
    () => (uploadText.trim() ? parseUpload(uploadText, generation, existing) : undefined),
    [existing, generation, uploadText],
  );

  const migrationPreview = useMemo(() => {
    if (!showMigration) return undefined;
    const known = new Set(
      existing.map((preset) => `${preset.generation}|${preset.species.toLowerCase()}|${preset.buildName.toLowerCase()}`),
    );
    const fresh: UploadPreset[] = [];
    const duplicates: UploadPreset[] = [];
    for (const set of localSets) {
      const candidate = localToUpload(set);
      const key = `${candidate.generation}|${candidate.species.toLowerCase()}|${candidate.buildName.toLowerCase()}`;
      if (known.has(key)) {
        duplicates.push(candidate);
      } else {
        known.add(key);
        fresh.push(candidate);
      }
    }
    return { fresh, duplicates };
  }, [existing, localSets, showMigration]);

  const builtInTrainers = useMemo(() => {
    const term = builtInSearch.trim().toLowerCase();
    const groups = new Map<string, PokemonPreset[]>();
    for (const preset of legacyPresets) {
      if (preset.generation !== generation || !preset.trainerName) continue;
      groups.set(preset.trainerName, [...(groups.get(preset.trainerName) ?? []), preset]);
    }
    return Array.from(groups, ([trainerName, presets]) => ({ trainerName, presets }))
      .filter(
        (group) =>
          !term ||
          group.trainerName.toLowerCase().includes(term) ||
          group.presets.some((preset) => preset.species.toLowerCase().includes(term)),
      )
      .sort((left, right) => left.trainerName.localeCompare(right.trainerName));
  }, [builtInSearch, generation, legacyPresets]);

  const readFile = async (file: File | undefined) => {
    if (!file) return;
    onMessage(undefined);
    setUploadText(await file.text());
  };

  const onDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setIsDragging(false);
    void readFile(event.dataTransfer.files[0]);
  };

  const submitUpload = async () => {
    if (!preview || preview.presets.length === 0) return;
    const outcome = await library.uploadPresets(preview.presets.map(toInput));
    if (outcome) {
      onMessage(
        `Uploaded ${outcome.created}, skipped ${outcome.duplicates} duplicate(s), ${outcome.errors.length} rejected by server.`,
      );
      if (outcome.errors.length === 0) setUploadText('');
    }
  };

  const submitMigration = async () => {
    if (!migrationPreview || migrationPreview.fresh.length === 0) return;
    const outcome = await library.uploadPresets(migrationPreview.fresh.map(toInput));
    if (!outcome) return;
    const failedIndexes = new Set(outcome.errors.map((entry) => entry.index));
    const migrated = migrationPreview.fresh
      .filter((_, index) => !failedIndexes.has(index))
      .map((preset) => preset.id);
    const duplicateIds = migrationPreview.duplicates.map((preset) => preset.id);
    onMigrated([...migrated, ...duplicateIds].filter((id) => localSets.some((set) => set.id === id)));
    onMessage(`Migrated ${outcome.created}; ${outcome.errors.length} could not be migrated and remain local.`);
    setShowMigration(false);
  };

  const copyTrainer = async (trainerName: string, presets: readonly PokemonPreset[]) => {
    // Built-in indexes are global encounter numbers, so the copy is appended to this library's order.
    const index = nextTrainerIndex(library.presets);
    const outcome = await library.uploadPresets(
      presets.map((preset) =>
        toInput({
          ...preset,
          index,
          sourceFormat: 'showdown',
          sourcePresetId: preset.id,
          sourceLibraryId: 'legacy',
        }),
      ),
    );
    if (!outcome) return;
    onMessage(
      `Copied ${outcome.created} Pokémon from ${trainerName}` +
        (outcome.duplicates > 0 ? ` (${outcome.duplicates} already in the library).` : '.'),
    );
    if (outcome.created > 0 || outcome.duplicates > 0) onTrainerCopied(trainerName);
  };

  const exportLibrary = (format: 'json' | 'showdown') => {
    const sets = library.presets.filter((preset) => preset.generation === generation);
    setExportText(
      format === 'json'
        ? serializePresetsAsJson(sets, generation)
        : sets
            .map((preset) =>
              serializePokemonSet({
                name: preset.nickname ?? preset.species,
                species: preset.species,
                gender: preset.gender,
                item: preset.item,
                ability: preset.ability,
                level: preset.level,
                teratype: preset.teraType,
                evs: preset.evs,
                ivs: preset.ivs,
                nature: preset.nature,
                moves: [...preset.moves],
              }),
            )
            .join('\n\n'),
    );
  };

  return (
    <div className="d-flex flex-column gap-3">
      {library.canEdit && (
        <section aria-labelledby="builtin-copy-title">
          <h4 id="builtin-copy-title" className="h6">Copy a built-in trainer</h4>
          <input
            className="form-control form-control-sm mb-2"
            aria-label="Search built-in trainers"
            placeholder="Search by trainer or Pokémon"
            value={builtInSearch}
            onChange={(event) => setBuiltInSearch(event.target.value)}
          />
          <div className="small text-body-secondary mb-2">
            {builtInTrainers.length} built-in trainer(s) in Gen {generation}
            {builtInTrainers.length > BUILT_IN_RESULT_LIMIT && ` — showing ${BUILT_IN_RESULT_LIMIT}, refine your search`}
          </div>
          <ul className="list-group">
            {builtInTrainers.slice(0, BUILT_IN_RESULT_LIMIT).map((group) => (
              <li
                className="list-group-item d-flex justify-content-between align-items-center gap-2"
                key={group.trainerName}
              >
                <span>
                  <strong>{group.trainerName}</strong>
                  <span className="text-body-secondary">
                    {' '}· {group.presets.map((preset) => preset.species).join(', ')}
                  </span>
                </span>
                <button
                  className="btn btn-sm btn-outline-primary text-nowrap"
                  type="button"
                  disabled={library.busy}
                  onClick={() => void copyTrainer(group.trainerName, group.presets)}
                >
                  Copy to library
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {library.canEdit && (
        <section
          aria-labelledby="bulk-upload-title"
          className={`border rounded p-3 ${isDragging ? 'border-primary bg-primary-subtle' : 'border-secondary-subtle'}`}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
        >
          <h4 id="bulk-upload-title" className="h6">Bulk upload</h4>
          <label className="form-label" htmlFor="user-library-file">
            Upload .txt or .json (or drop a file)
          </label>
          <input
            id="user-library-file"
            className="form-control mb-2"
            type="file"
            accept=".txt,.json,text/plain,application/json"
            onChange={(event) => void readFile(event.target.files?.[0])}
          />
          <textarea
            className="form-control"
            aria-label="Paste presets to upload"
            placeholder="…or paste Showdown text / JSON here"
            rows={4}
            value={uploadText}
            onChange={(event) => setUploadText(event.target.value)}
          />
          {preview && (
            <div className="mt-2">
              <p className="mb-1">
                {preview.format.toUpperCase()} · {preview.presets.length} valid, {preview.duplicates.length}{' '}
                duplicate(s), {preview.errors.length} invalid
              </p>
              {preview.errors.length > 0 && (
                <ul className="small text-danger" aria-label="Upload errors">
                  {preview.errors.map((entry) => (
                    <li key={`${entry.index}-${entry.label}`}>
                      {entry.label}: {entry.messages.join(' ')}
                    </li>
                  ))}
                </ul>
              )}
              <button
                className="btn btn-primary btn-sm"
                type="button"
                disabled={library.busy || preview.presets.length === 0}
                onClick={() => void submitUpload()}
              >
                {library.busy ? 'Uploading…' : `Upload ${preview.presets.length} preset(s)`}
              </button>
              {library.error && (
                <button className="btn btn-outline-secondary btn-sm ms-2" type="button" onClick={() => void submitUpload()}>
                  Retry
                </button>
              )}
            </div>
          )}
        </section>
      )}

      {library.canEdit && localSets.length > 0 && (
        <div>
          {!showMigration ? (
            <button className="btn btn-sm btn-outline-primary" type="button" onClick={() => setShowMigration(true)}>
              Migrate to library ({localSets.length} local)
            </button>
          ) : (
            migrationPreview && (
              <div className="border rounded p-3">
                <p className="mb-1">
                  {migrationPreview.fresh.length} to upload, {migrationPreview.duplicates.length} already in the
                  library (will be skipped). Local sets are kept until the server confirms.
                </p>
                <button
                  className="btn btn-primary btn-sm me-2"
                  type="button"
                  disabled={library.busy || migrationPreview.fresh.length === 0}
                  onClick={() => void submitMigration()}
                >
                  Confirm migration
                </button>
                <button className="btn btn-outline-secondary btn-sm" type="button" onClick={() => setShowMigration(false)}>
                  Cancel
                </button>
              </div>
            )
          )}
        </div>
      )}

      <section aria-labelledby="export-title">
        <h4 id="export-title" className="h6">Export (Gen {generation})</h4>
        <div className="d-flex flex-wrap gap-2">
          <button className="btn btn-sm btn-outline-secondary" type="button" onClick={() => exportLibrary('json')}>
            Export JSON
          </button>
          <button className="btn btn-sm btn-outline-secondary" type="button" onClick={() => exportLibrary('showdown')}>
            Export Showdown
          </button>
        </div>
        {exportText && (
          <textarea className="form-control mt-2" readOnly rows={6} aria-label="Exported library" value={exportText} />
        )}
      </section>
    </div>
  );
}
