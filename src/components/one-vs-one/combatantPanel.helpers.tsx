import type { BattleCombatant } from 'domain/index';
import type { ReactNode } from 'react';
import { setCombatantStat, statIds } from './combatantDraft';

type StatBucket = 'ivs' | 'evs' | 'boosts';

export function FieldGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="combatant-fieldset">
      <legend>{title}</legend>
      <div className="combatant-grid">{children}</div>
    </fieldset>
  );
}

export function StatGrid({
  title,
  combatant,
  bucket,
  onChange,
  min,
  max,
}: {
  title: string;
  combatant: BattleCombatant;
  bucket: StatBucket;
  onChange: (combatant: BattleCombatant) => void;
  min: number;
  max: number;
}) {
  return (
    <fieldset className="combatant-fieldset">
      <legend>{title}</legend>
      <div className="combatant-stat-grid">
        {statIds.map((statId: (typeof statIds)[number]) => (
          <label key={statId} className="combatant-field">
            <span>{statId.toUpperCase()}</span>
            <input
              type="number"
              min={min}
              max={max}
              value={combatant[bucket][statId]}
              onChange={(event) =>
                onChange(
                  setCombatantStat(
                    combatant,
                    bucket,
                    statId,
                    event.target.value,
                  ),
                )
              }
            />
          </label>
        ))}
      </div>
    </fieldset>
  );
}
