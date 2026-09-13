import { useState } from 'react';
import type { BattleCombatant, BattleStatId } from 'domain/index';
import { Generations } from 'calc-runtime/core/data';
import { getModifiedStat } from 'calc-runtime/core/mechanics/util';
import { Stats } from 'calc-runtime/core/stats';
import { getEvValidationError, setCombatantStat, statIds } from '../shared/combatantDraft';

const STAT_LABELS: Record<BattleStatId, string> = {
  hp: 'HP', atk: 'Attack', def: 'Defense', spa: 'Sp. Atk', spd: 'Sp. Def', spe: 'Speed',
};

const EV_PRESETS: Record<string, Partial<Record<BattleStatId, number>>> = {
  Custom: {},
  'Special Attack + Speed': { spa: 252, spe: 252 },
  'Attack + Speed': { atk: 252, spe: 252 },
  'HP + Defense': { hp: 252, def: 252 },
  'Max Speed': { spe: 252 },
};

type CombatantStatGridsProps = {
  combatant: BattleCombatant;
  onChange: (combatant: BattleCombatant) => void;
};

export default function CombatantStatGrids({
  combatant,
  onChange,
}: CombatantStatGridsProps) {
  const [evError, setEvError] = useState<string>();
  const generation = Generations.get(combatant.generation);
  const species = Array.from(generation.species).find(
    (option) => option.name === combatant.species,
  );
  const calculatedStats = statIds.map((statId) => {
    const rawValue = species
      ? Stats.calcStat(
          generation,
          statId,
          species.baseStats[statId],
          combatant.ivs[statId],
          combatant.evs[statId],
          combatant.level,
          combatant.nature,
        )
      : 0;

    return {
      statId,
      value:
        statId === 'hp'
          ? rawValue
          : getModifiedStat(
              rawValue,
              combatant.boosts[statId] ?? 0,
              generation,
            ),
    };
  });
  const totalEvs = statIds.reduce((sum, statId) => sum + combatant.evs[statId], 0);
  const baseStats = species?.baseStats;

  const applyPreset = (preset: keyof typeof EV_PRESETS) => {
    const values = EV_PRESETS[preset];
    const evs = statIds.reduce(
      (next, statId) => ({
        ...next,
        [statId]: values[statId] ?? 0,
      }),
      {},
    ) as BattleCombatant['evs'];
    onChange({ ...combatant, evs });
    setEvError(undefined);
  };

  const updateEv = (statId: BattleStatId, value: string) => {
    const error = getEvValidationError(combatant, statId, value);
    setEvError(error);
    if (!error) onChange(setCombatantStat(combatant, 'evs', statId, value));
  };

  return (
    <div className="combatant-stat-sections">
      <fieldset className="combatant-fieldset ev-editor">
        <div className="ev-toolbar d-flex align-items-center">
          <label className="ev-preset">
            <span>Preset</span>
            <select
              defaultValue="Custom"
              onChange={(event) =>
                applyPreset(event.target.value as keyof typeof EV_PRESETS)
              }
            >
              {Object.keys(EV_PRESETS).map((preset) => (
                <option key={preset}>{preset}</option>
              ))}
            </select>
          </label>
          <span className="ev-budget align-self-center">Remaining: {510 - totalEvs}</span>
          <button type="button" className="ev-clear" onClick={() => applyPreset('Custom')}>
            Clear EVs
          </button>
        </div>
        <div className="ev-column-headings" aria-hidden="true">
          <span>Stat</span><span>Base</span><span>IV</span><span>EV</span><span>Investment</span><span>Boost</span><span>Final</span>
        </div>
        {statIds.map((statId) => (
          <div key={statId} className="ev-row">
            <span>{STAT_LABELS[statId]}</span>
            <span className="ev-base-stat">{baseStats?.[statId] ?? '—'}</span>
            <input
              className="ev-iv"
              type="number"
              min={0}
              max={31}
              value={combatant.ivs[statId]}
              onChange={(event) =>
                onChange(setCombatantStat(combatant, 'ivs', statId, event.target.value))
              }
              aria-label={`${STAT_LABELS[statId]} IV`}
            />
            <input
              className="ev-value"
              type="number"
              min={0}
              max={252}
              step={4}
              value={combatant.evs[statId]}
              onChange={(event) => updateEv(statId, event.target.value)}
              aria-label={`${STAT_LABELS[statId]} EVs`}
            />
            <input
              type="range"
              min={0}
              max={252}
              step={4}
              value={combatant.evs[statId]}
              onChange={(event) => updateEv(statId, event.target.value)}
              aria-label={`${STAT_LABELS[statId]} EV slider`}
            />
            {statId === 'hp' ? (
              <span
                className="ev-boost ev-boost-na"
                aria-label="HP boosts do not apply"
              >
                —
              </span>
            ) : (
              <input
                className="ev-boost"
                type="number"
                min={-6}
                max={6}
                value={combatant.boosts[statId]}
                onChange={(event) =>
                  onChange(
                    setCombatantStat(
                      combatant,
                      'boosts',
                      statId,
                      event.target.value,
                    ),
                  )
                }
                aria-label={`${STAT_LABELS[statId]} boost`}
              />
            )}
            <strong className="ev-final-stat">{calculatedStats.find((stat) => stat.statId === statId)?.value ?? '—'}</strong>
          </div>
        ))}
        <div className="ev-total">Total: <strong>{totalEvs}</strong> / 510</div>
        {evError && <p className="field-error" role="alert">{evError}</p>}
      </fieldset>
    </div>
  );
}
