import { useEffect, useState } from 'react';
import type { BattleCombatant, BattleStatusName } from 'domain/index';
import {
  setCombatantField,
  setCombatantStatus,
} from '../shared/combatantDraft';
import { battleStatuses } from '../shared/combatantPanel.constants';
import { Generations } from 'calc-runtime/core/data';
import { Stats } from 'calc-runtime/core/stats';

type CombatantBattleStateFieldsProps = {
  combatant: BattleCombatant;
  onChange: (combatant: BattleCombatant) => void;
};

export default function CombatantBattleStateFields({
  combatant,
  onChange,
}: CombatantBattleStateFieldsProps) {
  const generation = Generations.get(combatant.generation);
  const species = Array.from(generation.species).find(
    (option) => option.name === combatant.species,
  );
  const pokemonHp = species
    ? Stats.calcStat(
        generation,
        'hp',
        species.baseStats.hp,
        combatant.ivs.hp,
        combatant.evs.hp,
        combatant.level,
        combatant.nature,
      )
    : undefined;
  const [displayHp, setDisplayHp] = useState<number | string>(
    combatant.currentHp === 0 ? (pokemonHp ?? 0) : combatant.currentHp,
  );

  useEffect(() => {
    setDisplayHp(pokemonHp ?? 0);
  }, [pokemonHp]);

  useEffect(() => {
    if (combatant.currentHp !== 0) {
      setDisplayHp(combatant.currentHp);
    }
  }, [combatant.currentHp]);

  return (
    <>
      <label className="combatant-field col-12 col-md-6 col-xl-3">
        <span className="form-label">Current HP{pokemonHp ? ` / ${pokemonHp}` : ''}</span>
        <input
          className="form-control"
          type="number"
          min={0}
          max={pokemonHp ?? 9999}
          value={displayHp}
          onChange={(event) => {
            setDisplayHp(event.target.value);
            onChange(
              setCombatantField(combatant, 'currentHp', event.target.value),
            );
          }}
        />
      </label>
      <label className="combatant-field col-12 col-md-6 col-xl-3">
        <span className="form-label">Status</span>
        <select
          className="form-select"
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
      <label className="combatant-field col-12 col-md-6 col-xl-3">
        <span className="form-label">Toxic counter</span>
        <input
          className="form-control"
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
      <label className="combatant-checkbox-field form-check col-12 col-md-6 col-xl-3 d-flex align-items-center gap-2">
        <input
          className="form-check-input mt-0"
          type="checkbox"
          checked={combatant.abilityOn}
          onChange={(event) =>
            onChange(
              setCombatantField(combatant, 'abilityOn', event.target.checked),
            )
          }
        />
        <span className="form-check-label">Ability active</span>
      </label>
      <label className="combatant-checkbox-field form-check col-12 col-md-6 col-xl-3 d-flex align-items-center gap-2">
        <input
          className="form-check-input mt-0"
          type="checkbox"
          checked={combatant.isDynamaxed}
          onChange={(event) =>
            onChange(
              setCombatantField(combatant, 'isDynamaxed', event.target.checked),
            )
          }
        />
        <span className="form-check-label">Dynamaxed</span>
      </label>
      <label className="combatant-field col-12 col-md-6 col-xl-3">
        <span className="form-label">Dynamax level</span>
        <input
          className="form-control"
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
