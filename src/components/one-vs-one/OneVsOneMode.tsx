import { useState } from 'react';
import type { BattleGeneration } from 'domain/index';
import type { CalculatorMode } from 'modes/calculatorModes';
import CombatantPanel from './CombatantPanel';
import {
  createTeamDraft,
  setTeamGeneration,
  toLegacyPokemonInput,
} from './combatantDraft';
import './OneVsOneMode.css';

const battleGenerations: readonly BattleGeneration[] = [
  0,
  1,
  2,
  3,
  4,
  5,
  6,
  7,
  8,
  9,
];

type OneVsOneModeProps = {
  mode: CalculatorMode;
};

function formatCombatantSummary({
  name,
  species,
  level,
  status,
  currentHp,
}: ReturnType<typeof createTeamDraft>['attacker']) {
  return `${name} (${species}) — Lv. ${level}, HP ${currentHp}${
    status ? `, ${status}` : ''
  }`;
}

export default function OneVsOneMode({ mode }: OneVsOneModeProps) {
  const [generation, setGeneration] = useState<BattleGeneration>(9);
  const [draft, setDraft] = useState(() => createTeamDraft(generation));
  const legacyDraft = {
    attacker: toLegacyPokemonInput(draft.attacker),
    defender: toLegacyPokemonInput(draft.defender),
  };
  const attackerMoveCount = legacyDraft.attacker.moves?.length ?? 0;
  const defenderMoveCount = legacyDraft.defender.moves?.length ?? 0;

  const updateGeneration = (nextGeneration: BattleGeneration) => {
    setGeneration(nextGeneration);
    setDraft((current) => setTeamGeneration(current, nextGeneration));
  };

  return (
    <section className="one-vs-one-screen">
      <header className="one-vs-one-intro">
        <p className="mode-kicker">{mode.label}</p>
        <div className="one-vs-one-copy">
          <h2>{mode.title}</h2>
          <p>{mode.description}</p>
        </div>
      </header>

      <section className="battle-controls" aria-label="Battle settings">
        <label className="combatant-field">
          <span>Generation</span>
          <select
            value={generation}
            onChange={(event) =>
              updateGeneration(
                Number(event.target.value) as BattleGeneration,
              )
            }
          >
            {battleGenerations.map((battleGeneration) => (
              <option key={battleGeneration} value={battleGeneration}>
                Gen {battleGeneration}
              </option>
            ))}
          </select>
        </label>

        <div className="battle-control-chip" aria-label="Battle format">
          Singles matchup
        </div>
      </section>

      <div className="one-vs-one-panels">
        <CombatantPanel
          title="Attacker panel"
          description="Edit the attacking combatant before calculating damage."
          combatant={draft.attacker}
          onChange={(attacker) =>
            setDraft((current) => ({
              ...current,
              attacker,
            }))
          }
        />

        <CombatantPanel
          title="Defender panel"
          description="Edit the defending combatant before calculating damage."
          combatant={draft.defender}
          onChange={(defender) =>
            setDraft((current) => ({
              ...current,
              defender,
            }))
          }
        />
      </div>

      <section className="battle-preview" aria-label="Battle snapshot">
        <div>
          <p className="battle-preview-label">Live snapshot</p>
          <h3>Ready for the calculator result panel</h3>
          <p className="battle-preview-copy">
            Legacy handoff keeps {attackerMoveCount} attacker moves and{' '}
            {defenderMoveCount} defender moves ready.
          </p>
        </div>
        <dl className="battle-preview-grid">
          <div>
            <dt>Attacker</dt>
            <dd>{formatCombatantSummary(draft.attacker)}</dd>
          </div>
          <div>
            <dt>Defender</dt>
            <dd>{formatCombatantSummary(draft.defender)}</dd>
          </div>
          <div>
            <dt>Generation</dt>
            <dd>{`Gen ${generation}`}</dd>
          </div>
          <div>
            <dt>Mode</dt>
            <dd>{mode.slug}</dd>
          </div>
        </dl>
      </section>
    </section>
  );
}
