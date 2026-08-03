import type { BattleCombatant } from 'domain/index';
import { setCombatantField } from './combatantDraft';
import { battleGenders } from './combatantPanel.constants';

type CombatantIdentityFieldsProps = {
  combatant: BattleCombatant;
  onChange: (combatant: BattleCombatant) => void;
};

export default function CombatantIdentityFields({
  combatant,
  onChange,
}: CombatantIdentityFieldsProps) {
  return (
    <>
      <label className="combatant-field">
        <span>Name</span>
        <input
          type="text"
          value={combatant.name}
          onChange={(event) =>
            onChange(setCombatantField(combatant, 'name', event.target.value))
          }
        />
      </label>
      <label className="combatant-field">
        <span>Species</span>
        <input
          type="text"
          value={combatant.species}
          onChange={(event) =>
            onChange(
              setCombatantField(combatant, 'species', event.target.value),
            )
          }
        />
      </label>
      <label className="combatant-field">
        <span>Gender</span>
        <select
          value={combatant.gender ?? 'N'}
          onChange={(event) =>
            onChange(
              setCombatantField(
                combatant,
                'gender',
                event.target.value as (typeof battleGenders)[number],
              ),
            )
          }
        >
          {battleGenders.map((gender) => (
            <option key={gender} value={gender}>
              {gender}
            </option>
          ))}
        </select>
      </label>
      <label className="combatant-field">
        <span>Level</span>
        <input
          type="number"
          min={1}
          max={100}
          value={combatant.level}
          onChange={(event) =>
            onChange(setCombatantField(combatant, 'level', event.target.value))
          }
        />
      </label>
      <label className="combatant-field">
        <span>Ability</span>
        <input
          type="text"
          value={combatant.ability ?? ''}
          onChange={(event) =>
            onChange(setCombatantField(combatant, 'ability', event.target.value))
          }
        />
      </label>
      <label className="combatant-field">
        <span>Item</span>
        <input
          type="text"
          value={combatant.item ?? ''}
          onChange={(event) =>
            onChange(setCombatantField(combatant, 'item', event.target.value))
          }
        />
      </label>
      <label className="combatant-field">
        <span>Nature</span>
        <input
          type="text"
          value={combatant.nature}
          onChange={(event) =>
            onChange(setCombatantField(combatant, 'nature', event.target.value))
          }
        />
      </label>
    </>
  );
}
