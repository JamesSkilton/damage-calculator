import { useState } from 'react';
import type { BattleCombatant, BattleGeneration } from 'domain/index';
import { parseUpload, presetIdentityKey, type UploadPreset } from '../../import/presetUpload';
import type { PresetInput, UserPreset } from '../../presets/remote/types';
import CombatantPanel from '../combatant/CombatantPanel';
import type { MoveOption } from '../combatant/moves/moveOptions';
import type { SpeciesOption } from '../combatant/species/speciesOptions';
import {
  createCombatantMovesState,
  type CombatantMovesState,
} from '../combatant/moves/combatantMovesState';
import { applyImportedPokemonSet, createTeamDraft } from '../combatant/shared/combatantDraft';
import { setMoveName } from '../combatant/moves/moveDraft';
import { NO_TRAINER_LABEL, toInput, uniqueBuildName } from './presetManagerUtils';

type EditorMode = 'visual' | 'json';

type PresetDraftEditorProps = {
  generation: BattleGeneration;
  initial?: UserPreset;
  trainerName: string;
  // Fight order given to a newly added Pokémon; edits keep the stored index.
  defaultIndex?: number;
  existing: readonly UserPreset[];
  busy: boolean;
  disabledReason?: string;
  availableSpecies: SpeciesOption[];
  availableMoves: MoveOption[];
  onSave: (input: PresetInput) => Promise<boolean>;
  onCancel: () => void;
};

function movesStateFrom(names: readonly string[]): CombatantMovesState {
  const base = createCombatantMovesState();
  return { ...base, slots: base.slots.map((slot, index) => setMoveName(slot, names[index] ?? '')) };
}

function buildDocument(
  generation: BattleGeneration,
  trainerName: string,
  buildName: string,
  combatant: BattleCombatant,
  moves: CombatantMovesState,
): string {
  return JSON.stringify(
    {
      schemaVersion: 1,
      generation,
      presets: [
        {
          species: combatant.species,
          buildName,
          ...(trainerName ? { trainerName } : {}),
          ...(combatant.name !== combatant.species ? { nickname: combatant.name } : {}),
          level: combatant.level,
          gender: combatant.gender,
          nature: combatant.nature,
          ...(combatant.ability ? { ability: combatant.ability } : {}),
          ...(combatant.item ? { item: combatant.item } : {}),
          ...(combatant.teratype ? { teraType: combatant.teratype } : {}),
          evs: combatant.evs,
          ivs: combatant.ivs,
          moves: moves.slots.map((move) => move.name).filter(Boolean),
        },
      ],
    },
    null,
    2,
  );
}

function parseSinglePreset(
  text: string,
  generation: BattleGeneration,
): { preset?: UploadPreset; error?: string } {
  const result = parseUpload(text, generation);
  if (result.errors.length > 0) {
    return { error: result.errors.flatMap((entry) => entry.messages).join(' ') };
  }
  if (result.presets.length !== 1) return { error: 'The JSON must contain exactly one preset.' };
  const [preset] = result.presets;
  if (preset.generation !== generation) {
    return { error: `The preset must be for Gen ${generation}.` };
  }
  return { preset };
}

export default function PresetDraftEditor({
  generation,
  initial,
  trainerName,
  defaultIndex,
  existing,
  busy,
  disabledReason,
  availableSpecies,
  availableMoves,
  onSave,
  onCancel,
}: PresetDraftEditorProps) {
  const [mode, setMode] = useState<EditorMode>('visual');
  const [buildName, setBuildName] = useState(initial?.buildName ?? '');
  const [combatant, setCombatant] = useState<BattleCombatant>(() =>
    initial
      ? applyImportedPokemonSet(createTeamDraft(generation).attacker, initial, availableSpecies)
      : createTeamDraft(generation).attacker,
  );
  const [moves, setMoves] = useState(() => movesStateFrom(initial?.moves ?? []));
  const [jsonText, setJsonText] = useState('');
  const [version, setVersion] = useState(0);
  const [error, setError] = useState<string>();

  const others = existing.filter((preset) => preset.id !== initial?.id);
  const resolveTitle = () =>
    buildName.trim() ||
    uniqueBuildName(trainerName || combatant.species, combatant.species, generation, others);

  const switchMode = (next: EditorMode) => {
    if (next === mode) return;
    setError(undefined);
    if (next === 'json') {
      setJsonText(buildDocument(generation, trainerName, resolveTitle(), combatant, moves));
      setMode('json');
      return;
    }
    const { preset, error: parseError } = parseSinglePreset(jsonText, generation);
    if (!preset) {
      setError(parseError);
      return;
    }
    setCombatant(applyImportedPokemonSet(createTeamDraft(generation).attacker, preset, availableSpecies));
    setMoves(movesStateFrom(preset.moves));
    setBuildName(preset.buildName);
    setVersion((current) => current + 1);
    setMode('visual');
  };

  const submit = async () => {
    setError(undefined);
    const text =
      mode === 'json'
        ? jsonText
        : buildDocument(generation, trainerName, resolveTitle(), combatant, moves);
    const { preset, error: parseError } = parseSinglePreset(text, generation);
    if (!preset) {
      setError(parseError);
      return;
    }
    if (others.some((other) => presetIdentityKey(other) === presetIdentityKey(preset))) {
      setError(`This library already has a ${preset.species} titled “${preset.buildName}”. Change the buildName in the JSON editor.`);
      return;
    }
    const input: PresetInput = {
      ...toInput(preset),
      trainerName: trainerName || undefined,
      index: initial ? initial.index : defaultIndex,
      sourceFormat: initial?.sourceFormat ?? preset.sourceFormat,
      sourcePresetId: initial?.sourcePresetId,
      sourceLibraryId: initial?.sourceLibraryId,
    };
    await onSave(input);
  };

  return (
    <div className="border rounded p-3 d-flex flex-column gap-3">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
        <h4 className="h6 mb-0">
          {initial ? `Edit ${initial.species}` : 'Add Pokémon'}
          <span className="text-body-secondary"> · {trainerName || NO_TRAINER_LABEL}</span>
        </h4>
        <div className="btn-group btn-group-sm" role="group" aria-label="Editor mode">
          <button
            className={`btn ${mode === 'visual' ? 'btn-primary' : 'btn-outline-primary'}`}
            type="button"
            aria-pressed={mode === 'visual'}
            onClick={() => switchMode('visual')}
          >
            Visual editor
          </button>
          <button
            className={`btn ${mode === 'json' ? 'btn-primary' : 'btn-outline-primary'}`}
            type="button"
            aria-pressed={mode === 'json'}
            onClick={() => switchMode('json')}
          >
            JSON
          </button>
        </div>
      </div>

      {error && <p className="mb-0 text-danger" role="alert">{error}</p>}

      {mode === 'visual' ? (
        <>
          <CombatantPanel
            key={`draft-${version}`}
            title="Preset editor"
            description="Configure the Pokémon, stats, and moves."
            combatant={combatant}
            onChange={setCombatant}
            generation={generation}
            moves={moves.slots}
            onMovesChange={(slots) => setMoves((current) => ({ ...current, slots }))}
            availableSpecies={availableSpecies}
            availableMoves={availableMoves}
          />
        </>
      ) : (
        <label className="form-label mb-0">
          <span className="d-block mb-1">Preset JSON</span>
          <textarea
            className="form-control font-monospace"
            rows={16}
            aria-label="Preset JSON editor"
            value={jsonText}
            onChange={(event) => setJsonText(event.target.value)}
          />
          <span className="form-text">
            One preset per document. The trainer is taken from the trainer page.
          </span>
        </label>
      )}

      <div className="d-flex flex-wrap align-items-center gap-2">
        <button
          className="btn btn-primary btn-sm"
          type="button"
          disabled={busy || Boolean(disabledReason)}
          onClick={() => void submit()}
        >
          {busy ? 'Saving…' : initial ? 'Save changes' : 'Add to trainer'}
        </button>
        <button className="btn btn-outline-secondary btn-sm" type="button" onClick={onCancel}>
          Cancel
        </button>
        {disabledReason && <span className="small text-body-secondary">{disabledReason}</span>}
      </div>
    </div>
  );
}
