import { useMemo, useState } from 'react';
import type { BattleGeneration } from 'domain/index';
import type { CalculatorMode } from 'modes/calculatorModes';
import CombatantPanel from '../combatant/CombatantPanel';
import { battleGenerations } from '../combatant/shared/combatantPanel.constants';
import {
  createTeamDraft,
  setTeamGeneration,
} from '../combatant/shared/combatantDraft';
import { createBattleFieldDraft } from '../combatant/shared/battleFieldDraft';
import {
  createCombatantMovesState,
  applyCombatantMovesGeneration,
} from '../combatant/moves/combatantMovesState';
import BattleFieldControls from './BattleFieldControls';
import BattleResultPanel from './BattleResultPanel';
import { buildBattleCalcBreakdowns } from 'adapters/battleCalc';
import './OneVsOneMode.scss';

type OneVsOneModeProps = {
  mode: CalculatorMode;
};

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

  const battleResults = useMemo(
    () =>
      buildBattleCalcBreakdowns({
        generation,
        attacker: draft.attacker,
        defender: draft.defender,
        field,
        moves: attackerMoves.slots,
      }),
    [attackerMoves.slots, draft.attacker, draft.defender, field, generation],
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

      <BattleResultPanel
        generationLabel={`Gen ${generation}`}
        field={field}
        attacker={draft.attacker}
        defender={draft.defender}
        results={battleResults}
      />
    </section>
  );
}
