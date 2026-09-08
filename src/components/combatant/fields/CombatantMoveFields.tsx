import type { BattleGeneration } from 'domain/index';
import type { MoveOption } from '../moves/moveOptions';
import type { MoveDraft } from '../moves/moveDraft';
import MovePickerRow from '../moves/MovePickerRow';
import { FieldGroup } from '../shared/combatantPanel.helpers';

type CombatantMoveFieldsProps = {
  generation: BattleGeneration;
  moves: readonly MoveDraft[];
  availableMoves?: MoveOption[];
  onChange: (moves: readonly MoveDraft[]) => void;
  mode?: 'simple' | 'advanced';
  attackerItem?: string;
};

export default function CombatantMoveFields({
  generation,
  moves,
  availableMoves,
  onChange,
  mode,
  attackerItem,
}: CombatantMoveFieldsProps) {
  const handleMoveChange = (index: number, move: MoveDraft) => {
    const updated = [...moves];
    updated[index] = move;
    onChange(updated);
  };

  return (
    <FieldGroup title="Moves">
      <div className={`moves-container moves-container-${mode ?? 'advanced'}`}>
        {moves.map((move, index) => (
          <MovePickerRow
            key={`move-${index}`}
            index={index}
            move={move}
            generation={generation}
            availableMoves={availableMoves}
            onChange={(updatedMove) => handleMoveChange(index, updatedMove)}
            mode={mode}
            attackerItem={attackerItem}
          />
        ))}
      </div>
    </FieldGroup>
  );
}
