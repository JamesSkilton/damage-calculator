import type { BattleGeneration } from 'domain/index';
import type { MoveDraft } from './moveDraft';
import {
  setMoveName,
  setMoveCrit,
  setMoveHits,
  setMoveZ,
  setMoveMax,
  setMoveStellar,
  setMoveTimesUsed,
  setMoveTimesUsedWithMetronome,
  isGenerationGated,
  resolveMoveDraftForGeneration,
} from './moveDraft';
import './MovePickerRow.css';

type MovePickerRowProps = {
  index: number;
  move: MoveDraft;
  generation: BattleGeneration;
  availableMoves?: string[];
  onChange: (move: MoveDraft) => void;
};

export default function MovePickerRow({
  index,
  move,
  generation,
  availableMoves,
  onChange,
}: MovePickerRowProps) {
  const slotNumber = index + 1;
  const canUseZ = isGenerationGated('z', generation);
  const canUseMax = isGenerationGated('max', generation);
  const canUseStellar = isGenerationGated('stellar', generation);

  // Ensure move state is valid for generation
  const validatedMove = resolveMoveDraftForGeneration(move, generation);

  const handleMoveNameChange = (name: string) => {
    onChange(setMoveName(validatedMove, name));
  };

  const handleCritChange = (isCrit: boolean) => {
    onChange(setMoveCrit(validatedMove, isCrit));
  };

  const handleHitsChange = (hits: string) => {
    onChange(setMoveHits(validatedMove, hits));
  };

  const handleZChange = (useZ: boolean) => {
    onChange(setMoveZ(validatedMove, useZ));
  };

  const handleMaxChange = (useMax: boolean) => {
    onChange(setMoveMax(validatedMove, useMax));
  };

  const handleStellarChange = (isStellarFirstUse: boolean) => {
    onChange(setMoveStellar(validatedMove, isStellarFirstUse));
  };

  const handleTimesUsedChange = (timesUsed: string) => {
    onChange(setMoveTimesUsed(validatedMove, timesUsed));
  };

  const handleTimesUsedWithMetronomeChange = (
    timesUsedWithMetronome: string | undefined,
  ) => {
    onChange(
      setMoveTimesUsedWithMetronome(validatedMove, timesUsedWithMetronome),
    );
  };

  return (
    <fieldset className="move-picker-row">
      <legend>Move {slotNumber}</legend>

      <div className="move-picker-container">
        <label className="move-picker-field">
          <span>Name</span>
          {availableMoves ? (
            <select
              value={validatedMove.name}
              onChange={(event) => handleMoveNameChange(event.target.value)}
              aria-label={`Move ${slotNumber} name`}
            >
              <option value="">— Select move —</option>
              {availableMoves.map((moveName) => (
                <option key={moveName} value={moveName}>
                  {moveName}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={validatedMove.name}
              onChange={(event) => handleMoveNameChange(event.target.value)}
              placeholder="Move name"
              aria-label={`Move ${slotNumber} name`}
            />
          )}
        </label>

        <label className="move-picker-field checkbox-field">
          <input
            type="checkbox"
            checked={validatedMove.isCrit}
            onChange={(event) => handleCritChange(event.target.checked)}
            aria-label={`Move ${slotNumber} critical hit`}
          />
          <span>Crit</span>
        </label>

        <label className="move-picker-field">
          <span>Hits</span>
          <input
            type="number"
            min={1}
            max={8}
            value={validatedMove.hits}
            onChange={(event) => handleHitsChange(event.target.value)}
            aria-label={`Move ${slotNumber} hits`}
          />
        </label>

        {canUseZ && (
          <label className="move-picker-field checkbox-field">
            <input
              type="checkbox"
              checked={validatedMove.useZ}
              onChange={(event) => handleZChange(event.target.checked)}
              aria-label={`Move ${slotNumber} Z-move`}
            />
            <span>Z-move</span>
          </label>
        )}

        {canUseMax && (
          <label className="move-picker-field checkbox-field">
            <input
              type="checkbox"
              checked={validatedMove.useMax}
              onChange={(event) => handleMaxChange(event.target.checked)}
              aria-label={`Move ${slotNumber} Max move`}
            />
            <span>Max</span>
          </label>
        )}

        {canUseStellar && (
          <label className="move-picker-field checkbox-field">
            <input
              type="checkbox"
              checked={validatedMove.isStellarFirstUse}
              onChange={(event) => handleStellarChange(event.target.checked)}
              aria-label={`Move ${slotNumber} Stellar first use`}
            />
            <span>Stellar 1st</span>
          </label>
        )}

        <label className="move-picker-field">
          <span>Times used</span>
          <input
            type="number"
            min={1}
            max={255}
            value={validatedMove.timesUsed}
            onChange={(event) => handleTimesUsedChange(event.target.value)}
            aria-label={`Move ${slotNumber} times used`}
          />
        </label>

        <label className="move-picker-field">
          <span>Metronome times</span>
          <input
            type="number"
            min={0}
            max={255}
            value={validatedMove.timesUsedWithMetronome ?? ''}
            onChange={(event) =>
              handleTimesUsedWithMetronomeChange(
                event.target.value === '' ? undefined : event.target.value,
              )
            }
            aria-label={`Move ${slotNumber} metronome times`}
          />
        </label>
      </div>
    </fieldset>
  );
}
