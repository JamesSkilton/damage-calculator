import type { BattleGeneration } from 'domain/index';
import type { MoveDraft } from '../moves/moveDraft';
import MovePickerRow from '../moves/MovePickerRow';
import { FieldGroup } from '../shared/combatantPanel.helpers';

type CombatantMoveFieldsProps = {
  generation: BattleGeneration;
  moves: readonly MoveDraft[];
  availableMoves?: string[];
  onChange: (moves: readonly MoveDraft[]) => void;
};

export default function CombatantMoveFields({
  generation,
  moves,
  availableMoves,
  onChange,
}: CombatantMoveFieldsProps) {
  const handleMoveChange = (index: number, move: MoveDraft) => {
    const updated = [...moves];
    updated[index] = move;
    onChange(updated);
  };

  return (
    <FieldGroup title="Moves">
      <div className="moves-container">
        {moves.map((move, index) => (
          <MovePickerRow
            key={`move-${index}`}
            index={index}
            move={move}
            generation={generation}
            availableMoves={availableMoves}
            onChange={(updatedMove) => handleMoveChange(index, updatedMove)}
          />
        ))}
      </div>
    </FieldGroup>
  );
}
