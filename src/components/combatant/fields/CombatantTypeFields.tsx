import type { BattleCombatant, BattleTypeName } from 'domain/index';
import { setCombatantField, setCombatantTypes } from '../shared/combatantDraft';
import { battleTypes } from '../shared/combatantPanel.constants';

type CombatantTypeFieldsProps = {
  combatant: BattleCombatant;
  onChange: (combatant: BattleCombatant) => void;
};

export default function CombatantTypeFields({
  combatant,
  onChange,
}: CombatantTypeFieldsProps) {
  const [primaryType, secondaryType] = combatant.types;

  return (
    <>
      <label className="combatant-field">
        <span>Primary type</span>
        <select
          value={primaryType}
          onChange={(event) =>
            onChange(
              setCombatantTypes(
                combatant,
                event.target.value as BattleTypeName,
                secondaryType,
              ),
            )
          }
        >
          {battleTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </label>
      <label className="combatant-field">
        <span>Secondary type</span>
        <select
          value={secondaryType ?? ''}
          onChange={(event) =>
            onChange(
              setCombatantTypes(
                combatant,
                primaryType,
                event.target.value === ''
                  ? undefined
                  : (event.target.value as BattleTypeName),
              ),
            )
          }
        >
          <option value="">None</option>
          {battleTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </label>
      <label className="combatant-field">
        <span>Tera type</span>
        <select
          value={combatant.teratype ?? ''}
          onChange={(event) =>
            onChange(
              setCombatantField(
                combatant,
                'teratype',
                event.target.value === ''
                  ? undefined
                  : (event.target.value as BattleTypeName),
              ),
            )
          }
        >
          <option value="">None</option>
          {battleTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
