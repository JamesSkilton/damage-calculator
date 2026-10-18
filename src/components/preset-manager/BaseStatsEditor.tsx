import { useMemo, useState, type DragEvent } from 'react';
import type { BattleGeneration, BattleStatId, BattleStats } from 'domain/index';
import { Generations } from 'calc-runtime/core/data';
import { toID } from 'calc-runtime/core/util';
import {
  BASE_STAT_IDS,
  MAX_BASE_STAT_VALUE,
  baseStatKey,
  mergeBaseStatEntries,
  parseBaseStatsUpload,
  serializeBaseStats,
  validateBaseStatEntries,
  type SpeciesBaseStats,
} from '../../presets/baseStats';
import type { UserPresetLibraryState } from '../../presets/remote/useUserPresetLibrary';
import SearchablePokemonPicker from '../combatant/species/SearchablePokemonPicker';
import type { SpeciesOption } from '../combatant/species/speciesOptions';

const STAT_LABELS: Record<BattleStatId, string> = {
  hp: 'HP', atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe',
};

type BaseStatsEditorProps = {
  library: UserPresetLibraryState;
  generation: BattleGeneration;
  availableSpecies: SpeciesOption[];
  onMessage: (message: string | undefined) => void;
};

export default function BaseStatsEditor({ library, generation, availableSpecies, onMessage }: BaseStatsEditorProps) {
  const [uploadText, setUploadText] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [exportText, setExportText] = useState('');
  const [species, setSpecies] = useState('');
  const [draft, setDraft] = useState<Partial<Record<BattleStatId, string>>>({});
  const [formError, setFormError] = useState<string>();

  const overrides = useMemo(
    () =>
      library.baseStats
        .filter((entry) => entry.generation === generation)
        .sort((left, right) => left.species.localeCompare(right.species)),
    [generation, library.baseStats],
  );

  const resolveDefault = useMemo(() => {
    const gen = Generations.get(generation);
    return (name: string) => {
      const found = gen.species.get(toID(name));
      return found ? { name: found.name, baseStats: found.baseStats as BattleStats } : undefined;
    };
  }, [generation]);

  const preview = useMemo(
    () => (uploadText.trim() ? parseBaseStatsUpload(uploadText, generation, resolveDefault) : undefined),
    [generation, resolveDefault, uploadText],
  );

  const save = async (next: SpeciesBaseStats[], success: string) => {
    const { messages } = validateBaseStatEntries(next);
    if (messages.length > 0) {
      onMessage(messages.join(' '));
      return false;
    }
    const ok = await library.saveBaseStats(next);
    if (ok) onMessage(success);
    return ok;
  };

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
    if (!preview || preview.entries.length === 0) return;
    const ok = await save(
      mergeBaseStatEntries(library.baseStats, preview.entries),
      `Saved base stats for ${preview.entries.length} Pokémon.`,
    );
    if (ok) setUploadText('');
  };

  const pickSpecies = (value: string) => {
    setSpecies(value);
    setFormError(undefined);
    const known = resolveDefault(value);
    if (!known) {
      setDraft({});
      return;
    }
    const current = overrides.find((entry) => baseStatKey(entry.generation, entry.species) === baseStatKey(generation, known.name));
    const source = current?.baseStats ?? known.baseStats;
    setDraft(Object.fromEntries(BASE_STAT_IDS.map((stat) => [stat, String(source[stat])])));
  };

  const submitForm = async () => {
    const known = resolveDefault(species);
    if (!known) {
      setFormError(`Unknown species "${species}" in Gen ${generation}.`);
      return;
    }
    const baseStats = Object.fromEntries(BASE_STAT_IDS.map((stat) => [stat, Number(draft[stat])]));
    const parsed = parseBaseStatsUpload(
      JSON.stringify({ baseStats: [{ species: known.name, baseStats }] }),
      generation,
      resolveDefault,
    );
    if (parsed.errors.length > 0) {
      setFormError(parsed.errors.join(' '));
      return;
    }
    setFormError(undefined);
    const ok = await save(mergeBaseStatEntries(library.baseStats, parsed.entries), `Saved base stats for ${known.name}.`);
    if (ok) {
      setSpecies('');
      setDraft({});
    }
  };

  const remove = async (entry: SpeciesBaseStats) => {
    const key = baseStatKey(entry.generation, entry.species);
    await save(
      library.baseStats.filter((candidate) => baseStatKey(candidate.generation, candidate.species) !== key),
      `Reset ${entry.species} to its default base stats.`,
    );
  };

  const defaultFor = (entry: SpeciesBaseStats) => resolveDefault(entry.species)?.baseStats;

  return (
    <div className="d-flex flex-column gap-3">
      <p className="small text-body-secondary mb-0">
        Override a Pokémon’s base stats for this library. Overrides apply to every preset of that species in Gen{' '}
        {generation} whenever this library is selected for calculations.
      </p>

      {overrides.length === 0 ? (
        <p className="mb-0 text-body-secondary">No base stat overrides in Gen {generation}.</p>
      ) : (
        <div className="table-responsive">
          <table className="table table-sm align-middle mb-0">
            <thead>
              <tr>
                <th scope="col">Pokémon</th>
                {BASE_STAT_IDS.map((stat) => (
                  <th scope="col" key={stat}>{STAT_LABELS[stat]}</th>
                ))}
                {library.canEdit && <th scope="col" />}
              </tr>
            </thead>
            <tbody>
              {overrides.map((entry) => {
                const defaults = defaultFor(entry);
                return (
                  <tr key={baseStatKey(entry.generation, entry.species)}>
                    <th scope="row">{entry.species}</th>
                    {BASE_STAT_IDS.map((stat) => (
                      <td
                        key={stat}
                        className={defaults && defaults[stat] !== entry.baseStats[stat] ? 'fw-semibold text-primary' : undefined}
                        title={defaults ? `Default ${defaults[stat]}` : undefined}
                      >
                        {entry.baseStats[stat]}
                      </td>
                    ))}
                    {library.canEdit && (
                      <td className="text-end text-nowrap">
                        <button
                          className="btn btn-sm btn-outline-primary me-2"
                          type="button"
                          aria-label={`Edit ${entry.species} base stats`}
                          onClick={() => pickSpecies(entry.species)}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-sm btn-outline-danger"
                          type="button"
                          disabled={library.busy}
                          aria-label={`Reset ${entry.species} base stats`}
                          onClick={() => void remove(entry)}
                        >
                          Reset
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {library.canEdit && (
        <section aria-labelledby="base-stats-form-title" className="border rounded p-3">
          <h4 id="base-stats-form-title" className="h6">Add or edit a Pokémon</h4>
          <div className="d-flex flex-wrap gap-2 align-items-end">
            <div>
              <span className="d-block small">Pokémon</span>
              <SearchablePokemonPicker
                value={species}
                options={availableSpecies}
                onSelect={pickSpecies}
                ariaLabel="Base stats Pokémon"
              />
            </div>
            {BASE_STAT_IDS.map((stat) => (
              <label className="form-label mb-0" key={stat}>
                <span className="d-block small">{STAT_LABELS[stat]}</span>
                <input
                  className="form-control form-control-sm"
                  style={{ width: '5rem' }}
                  type="number"
                  min={1}
                  max={MAX_BASE_STAT_VALUE}
                  aria-label={`Base ${STAT_LABELS[stat]}`}
                  value={draft[stat] ?? ''}
                  disabled={!resolveDefault(species)}
                  onChange={(event) => setDraft((current) => ({ ...current, [stat]: event.target.value }))}
                />
              </label>
            ))}
            <button
              className="btn btn-primary btn-sm"
              type="button"
              disabled={library.busy || !species.trim()}
              onClick={() => void submitForm()}
            >
              Save
            </button>
          </div>
          {formError && <p className="small text-danger mt-2 mb-0" role="alert">{formError}</p>}
        </section>
      )}

      {library.canEdit && (
        <section
          aria-labelledby="base-stats-upload-title"
          className={`border rounded p-3 ${isDragging ? 'border-primary bg-primary-subtle' : 'border-secondary-subtle'}`}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
        >
          <h4 id="base-stats-upload-title" className="h6">Upload base stats (JSON)</h4>
          <input
            className="form-control mb-2"
            type="file"
            accept=".json,application/json"
            aria-label="Upload base stats file"
            onChange={(event) => void readFile(event.target.files?.[0])}
          />
          <textarea
            className="form-control font-monospace"
            aria-label="Paste base stats JSON"
            placeholder={`{ "schemaVersion": 1, "generation": ${generation}, "baseStats": [ { "species": "Pikachu", "baseStats": { "spe": 120 } } ] }`}
            rows={4}
            value={uploadText}
            onChange={(event) => setUploadText(event.target.value)}
          />
          <div className="form-text">
            Stats you leave out keep the Pokémon’s default. Existing overrides for the same Pokémon are replaced.
          </div>
          {preview && (
            <div className="mt-2">
              <p className="mb-1">
                {preview.entries.length} valid, {preview.errors.length} invalid
              </p>
              {preview.errors.length > 0 && (
                <ul className="small text-danger" aria-label="Base stats upload errors">
                  {preview.errors.map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
              )}
              <button
                className="btn btn-primary btn-sm"
                type="button"
                disabled={library.busy || preview.entries.length === 0}
                onClick={() => void submitUpload()}
              >
                {library.busy ? 'Saving…' : `Save ${preview.entries.length} Pokémon`}
              </button>
            </div>
          )}
        </section>
      )}

      <section aria-labelledby="base-stats-export-title">
        <h4 id="base-stats-export-title" className="h6">Export (Gen {generation})</h4>
        <button
          className="btn btn-sm btn-outline-secondary"
          type="button"
          onClick={() => setExportText(serializeBaseStats(library.baseStats, generation))}
        >
          Export base stats JSON
        </button>
        {exportText && (
          <textarea className="form-control font-monospace mt-2" readOnly rows={6} aria-label="Exported base stats" value={exportText} />
        )}
      </section>
    </div>
  );
}
