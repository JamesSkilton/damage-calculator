import { useMemo, useState } from 'react';
import type { BattleField, BattleGeneration } from 'domain/index';
import type { CalculatorMode } from 'modes/calculatorModes';
import CombatantPanel from '../combatant/CombatantPanel';
import { battleGenerations } from '../combatant/shared/combatantPanel.constants';
import {
  createTeamDraft,
  setTeamGeneration,
  toLegacyBattlePayload,
} from '../combatant/shared/combatantDraft';
import { createBattleFieldDraft } from '../combatant/shared/battleFieldDraft';
import {
  createCombatantMovesState,
  applyCombatantMovesGeneration,
} from '../combatant/moves/combatantMovesState';
import BattleFieldControls from './BattleFieldControls';
import './OneVsOneMode.css';

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

function formatFieldSummary(field: BattleField) {
  const weather = field.weather ?? 'Clear';
  const terrain = field.terrain ?? 'No terrain';

  return `${weather} weather, ${terrain}`;
}

export default function OneVsOneMode({ mode }: OneVsOneModeProps) {
  const [generation, setGeneration] = useState<BattleGeneration>(9);
  const [draft, setDraft] = useState(() => createTeamDraft(generation));
  const [field, setField] = useState(() => createBattleFieldDraft(generation));
  const [attackerMoves, setAttackerMoves] = useState(() =>
    createCombatantMovesState(),
  );
  const [defenderMoves, setDefenderMoves] = useState(() =>
    createCombatantMovesState(),
  );

  const battlePayload = useMemo(
    () =>
      toLegacyBattlePayload(
        generation,
        draft.attacker,
        attackerMoves.slots,
        draft.defender,
        defenderMoves.slots,
        field,
      ),
    [
      attackerMoves.slots,
      defenderMoves.slots,
      draft.attacker,
      draft.defender,
      generation,
      field,
    ],
  );

  const updateGeneration = (nextGeneration: BattleGeneration) => {
    setGeneration(nextGeneration);
    setDraft((current) => setTeamGeneration(current, nextGeneration));
    // Apply generation gating to move state
    setAttackerMoves((current) =>
      applyCombatantMovesGeneration(current, nextGeneration),
    );
    setDefenderMoves((current) =>
      applyCombatantMovesGeneration(current, nextGeneration),
    );
    setField((current) => ({
      ...current,
      generation: nextGeneration,
    }));
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
              updateGeneration(Number(event.target.value) as BattleGeneration)
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

        <BattleFieldControls field={field} onChange={setField} />
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
          generation={generation}
          moves={attackerMoves.slots}
          onMovesChange={(moves) =>
            setAttackerMoves((current) => ({
              ...current,
              slots: moves,
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
          generation={generation}
          moves={defenderMoves.slots}
          onMovesChange={(moves) =>
            setDefenderMoves((current) => ({
              ...current,
              slots: moves,
            }))
          }
        />
      </div>

      <section className="battle-preview" aria-label="Battle snapshot">
        <div>
          <p className="battle-preview-label">Live snapshot</p>
          <h3>Ready for the calculator result panel</h3>
          <p className="battle-preview-copy">
            Legacy handoff keeps {battlePayload.attacker.moves.length} attacker
            moves and {battlePayload.defender.moves.length} defender moves ready
            for {formatFieldSummary(field)}.
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
          <div>
            <dt>Field</dt>
            <dd>{formatFieldSummary(field)}</dd>
          </div>
        </dl>
      </section>
    </section>
  );
}
