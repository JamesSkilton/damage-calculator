import type { BattleCombatant, BattleStatusName } from 'domain/index';
import { setCombatantField, setCombatantStatus } from './combatantDraft';
import { battleStatuses } from './combatantPanel.constants';

type CombatantBattleStateFieldsProps = {
  combatant: BattleCombatant;
  onChange: (combatant: BattleCombatant) => void;
};

export default function CombatantBattleStateFields({
  combatant,
  onChange,
}: CombatantBattleStateFieldsProps) {
  return (
    <>
      <label className="combatant-field">
        <span>Current HP</span>
        <input
          type="number"
          min={0}
          max={9999}
          value={combatant.currentHp}
          onChange={(event) =>
            onChange(
              setCombatantField(combatant, 'currentHp', event.target.value),
            )
          }
        />
      </label>
      <label className="combatant-field">
        <span>Status</span>
        <select
          value={combatant.status ?? ''}
          onChange={(event) =>
            onChange(
              setCombatantStatus(
                combatant,
                event.target.value as BattleStatusName | '',
              ),
            )
          }
        >
          {battleStatuses.map((status) => (
            <option key={status || 'clear'} value={status}>
              {status === '' ? 'Healthy' : status}
            </option>
          ))}
        </select>
      </label>
      <label className="combatant-field">
        <span>Toxic counter</span>
        <input
          type="number"
          min={0}
          max={15}
          value={combatant.toxicCounter}
          onChange={(event) =>
            onChange(
              setCombatantField(combatant, 'toxicCounter', event.target.value),
            )
          }
        />
      </label>
      <label className="combatant-field checkbox-field">
        <input
          type="checkbox"
          checked={combatant.abilityOn}
          onChange={(event) =>
            onChange(
              setCombatantField(combatant, 'abilityOn', event.target.checked),
            )
          }
        />
        <span>Ability active</span>
      </label>
      <label className="combatant-field checkbox-field">
        <input
          type="checkbox"
          checked={combatant.isDynamaxed}
          onChange={(event) =>
            onChange(
              setCombatantField(
                combatant,
                'isDynamaxed',
                event.target.checked,
              ),
            )
          }
        />
        <span>Dynamaxed</span>
      </label>
      <label className="combatant-field">
        <span>Dynamax level</span>
        <input
          type="number"
          min={0}
          max={10}
          value={combatant.dynamaxLevel ?? ''}
          onChange={(event) =>
            onChange(
              setCombatantField(combatant, 'dynamaxLevel', event.target.value),
            )
          }
          disabled={!combatant.isDynamaxed}
        />
      </label>
    </>
  );
}
