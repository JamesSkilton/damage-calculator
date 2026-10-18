import { useMemo, useState } from 'react';
import type { BattleGeneration } from 'domain/index';
import type { PresetInput, UserPreset } from '../../presets/remote/types';
import type { UserPresetLibraryState } from '../../presets/remote/useUserPresetLibrary';
import type { MoveOption } from '../combatant/moves/moveOptions';
import type { SpeciesOption } from '../combatant/species/speciesOptions';
import PresetDraftEditor from './PresetDraftEditor';
import PresetSummaryTable from './PresetSummaryTable';
import { NO_TRAINER_LABEL, nextTrainerIndex, toUpdateChanges } from './presetManagerUtils';

type TrainerEditorProps = {
  library: UserPresetLibraryState;
  generation: BattleGeneration;
  // undefined starts a brand new trainer.
  trainerName: string | undefined;
  availableSpecies: SpeciesOption[];
  availableMoves: MoveOption[];
  onBack: () => void;
  onMessage: (message: string | undefined) => void;
};

type Editing = { preset?: UserPreset };

export default function TrainerEditor({
  library,
  generation,
  trainerName,
  availableSpecies,
  availableMoves,
  onBack,
  onMessage,
}: TrainerEditorProps) {
  const [committedName, setCommittedName] = useState(trainerName);
  const [nameDraft, setNameDraft] = useState(trainerName ?? '');
  const [editing, setEditing] = useState<Editing | undefined>(
    trainerName === undefined ? {} : undefined,
  );
  const [error, setError] = useState<string>();

  const roster = useMemo(
    () =>
      committedName === undefined
        ? []
        : library.presets.filter(
            (preset) =>
              preset.generation === generation && (preset.trainerName?.trim() ?? '') === committedName,
          ),
    [committedName, generation, library.presets],
  );

  const trimmedDraft = nameDraft.trim();
  const activeName = committedName ?? trimmedDraft;
  const canRename =
    committedName !== undefined &&
    roster.length > 0 &&
    trimmedDraft !== '' &&
    trimmedDraft !== committedName;
  const missingName = committedName === undefined && trimmedDraft === '';

  const savePreset = async (input: PresetInput): Promise<boolean> => {
    setError(undefined);
    if (editing?.preset) {
      const ok = await library.updatePreset(editing.preset.id, toUpdateChanges(input));
      if (ok) {
        onMessage(`Saved ${input.species}.`);
        setEditing(undefined);
      }
      return ok;
    }
    const outcome = await library.uploadPresets([input]);
    if (!outcome || outcome.created === 0) {
      setError(outcome?.errors[0]?.message ?? 'That Pokémon could not be added.');
      return false;
    }
    if (committedName === undefined) setCommittedName(activeName);
    onMessage(`Added ${input.species} to ${activeName || NO_TRAINER_LABEL}.`);
    setEditing(undefined);
    return true;
  };

  const rename = async () => {
    setError(undefined);
    for (const preset of roster) {
      if (!(await library.updatePreset(preset.id, { trainerName: trimmedDraft }))) {
        setError('Renaming stopped part-way. Refresh the library and try again.');
        return;
      }
    }
    setCommittedName(trimmedDraft);
    onMessage(`Renamed trainer to ${trimmedDraft}.`);
  };

  const remove = async (preset: UserPreset) => {
    if (!window.confirm(`Remove ${preset.species} from this trainer?`)) return;
    if (await library.deletePreset(preset.id)) onMessage(`Removed ${preset.species}.`);
  };

  return (
    <div className="d-flex flex-column gap-3">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
        <button className="btn btn-sm btn-outline-secondary" type="button" onClick={onBack}>
          ← Back to {library.snapshot?.library.name ?? 'library'}
        </button>
        <span className="small text-body-secondary">Gen {generation}</span>
      </div>

      <div>
        <p className="eyebrow mb-1">{committedName === undefined ? 'New trainer' : 'Trainer'}</p>
        <div className="input-group w-100" style={{ maxWidth: '32rem' }}>
          <input
            className="form-control"
            aria-label="Trainer name"
            placeholder="Trainer name, e.g. Gym Leader Roxanne"
            value={nameDraft}
            disabled={!library.canEdit}
            onChange={(event) => setNameDraft(event.target.value)}
          />
          {canRename && (
            <button
              className="btn btn-outline-primary"
              type="button"
              disabled={library.busy}
              onClick={() => void rename()}
            >
              Rename
            </button>
          )}
        </div>
      </div>

      {error && <p className="mb-0 text-danger" role="alert">{error}</p>}
      {!library.canEdit && (
        <p className="mb-0 text-body-secondary">
          This library is read-only. Open it with an owner code to edit.
        </p>
      )}

      <section aria-labelledby="trainer-roster-title">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <h3 id="trainer-roster-title" className="h6 mb-0">
            Pokémon ({roster.length})
          </h3>
          {library.canEdit && !editing && (
            <button className="btn btn-sm btn-primary" type="button" onClick={() => setEditing({})}>
              Add Pokémon
            </button>
          )}
        </div>
        {roster.length === 0 ? (
          <p className="text-body-secondary mb-0">No Pokémon on this trainer yet.</p>
        ) : (
          <div className="border rounded">
            <PresetSummaryTable
              presets={roster}
              renderActions={
                library.canEdit
                  ? (preset) => (
                      <span className="d-inline-flex gap-2">
                        <button
                          className="btn btn-sm btn-outline-secondary"
                          type="button"
                          aria-label={`Edit ${preset.species}`}
                          onClick={() => setEditing({ preset })}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-sm btn-outline-danger"
                          type="button"
                          disabled={library.busy}
                          aria-label={`Remove ${preset.species}`}
                          onClick={() => void remove(preset)}
                        >
                          Remove
                        </button>
                      </span>
                    )
                  : undefined
              }
            />
          </div>
        )}
      </section>

      {library.canEdit && editing && (
        <PresetDraftEditor
          key={editing.preset?.id ?? 'new'}
          generation={generation}
          initial={editing.preset}
          defaultIndex={roster.length > 0 ? roster[0].index : nextTrainerIndex(library.presets)}
          trainerName={activeName}
          existing={library.presets}
          busy={library.busy}
          disabledReason={missingName ? 'Enter a trainer name first.' : undefined}
          availableSpecies={availableSpecies}
          availableMoves={availableMoves}
          onSave={savePreset}
          onCancel={() => setEditing(undefined)}
        />
      )}
    </div>
  );
}
