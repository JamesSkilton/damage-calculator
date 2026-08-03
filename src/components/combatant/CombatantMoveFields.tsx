import type { BattleCombatant } from 'domain/index';
import { setCombatantMove } from './combatantDraft';
import { FieldGroup } from './combatantPanel.helpers';

type CombatantMoveFieldsProps = {
  combatant: BattleCombatant;
  onChange: (combatant: BattleCombatant) => void;
};

export default function CombatantMoveFields({
  combatant,
  onChange,
}: CombatantMoveFieldsProps) {
  return (
    <FieldGroup title="Moves">
      {combatant.moves.map((move, index) => (
        <label key={`move-${index}`} className="combatant-field">
          <span>Move {index + 1}</span>
          <input
            type="text"
            value={move}
            onChange={(event) =>
              onChange(setCombatantMove(combatant, index, event.target.value))
            }
          />
        </label>
      ))}
    </FieldGroup>
  );
}
