import { useMemo, useState } from 'react';
import type { BattleGeneration } from 'domain/index';
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
  setCombatantMoveSlot,
} from '../combatant/moves/combatantMovesState';
import { setMoveName, setMoveCrit } from '../combatant/moves/moveDraft';
import { buildMoveCatalog } from '../combatant/moves/moveCatalog';
import { buildSpeciesCatalog } from '../combatant/species/speciesCatalog';
import BattleFieldControls from './BattleFieldControls';
import BattleResultPanel from './BattleResultPanel';
import BattlePlanner from '../battle-planner/BattlePlanner';
import { buildBattleCalcBreakdowns } from 'adapters/battleCalc';
import './OneVsOneMode.scss';

export default function OneVsOneMode() {
  const [generation, setGeneration] = useState<BattleGeneration>(9);
  const [draft, setDraft] = useState(() => createTeamDraft(generation));
  const [field, setField] = useState(() => createBattleFieldDraft(generation));
  const [attackerMoves, setAttackerMoves] = useState(() =>
    createCombatantMovesState(),
  );
  const [defenderMoves, setDefenderMoves] = useState(() =>
    createCombatantMovesState(),
  );
  const [isResultsSwapped, setIsResultsSwapped] = useState(false);
  const [isPlannerOpen, setIsPlannerOpen] = useState(false);

  const availableMoves = useMemo(
    () => buildMoveCatalog(generation),
    [generation],
  );

  const availableSpecies = useMemo(
    () => buildSpeciesCatalog(generation),
    [generation],
  );

  const attackerResults = useMemo(
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

  const defenderResults = useMemo(
    () =>
      buildBattleCalcBreakdowns({
        generation,
        attacker: draft.defender,
        defender: draft.attacker,
        field,
        moves: defenderMoves.slots,
      }),
    [defenderMoves.slots, draft.attacker, draft.defender, field, generation],
  );

  const displayedAttacker = isResultsSwapped
    ? draft.defender
    : draft.attacker;
  const displayedDefender = isResultsSwapped
    ? draft.attacker
    : draft.defender;
  const displayedMoves = isResultsSwapped
    ? defenderMoves.slots
    : attackerMoves.slots;
  const displayedResults = isResultsSwapped
    ? defenderResults
    : attackerResults;

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
      {isPlannerOpen ? (
        <BattlePlanner
          generation={generation}
          attacker={draft.attacker}
          defender={draft.defender}
          field={field}
          availableMoves={availableMoves}
          attackerMoves={attackerMoves.slots}
          defenderMoves={defenderMoves.slots}
        />
      ) : (
        <BattleResultPanel
        title={isResultsSwapped ? 'Defender damage' : 'Attacker damage'}
        attacker={displayedAttacker}
        defender={displayedDefender}
        moves={displayedMoves}
        results={displayedResults}
        availableMoves={availableMoves}
        availableSpecies={availableSpecies}
        onSwapSides={() => setIsResultsSwapped((current) => !current)}
        onAttackerChange={(combatant) =>
          setDraft((current) => ({
            ...current,
            [isResultsSwapped ? 'defender' : 'attacker']: combatant,
          }))
        }
        onDefenderChange={(combatant) =>
          setDraft((current) => ({
            ...current,
            [isResultsSwapped ? 'attacker' : 'defender']: combatant,
          }))
        }
        onMoveNameChange={(slotIndex, moveName) =>
          (isResultsSwapped ? setDefenderMoves : setAttackerMoves)((current) => {
            const existing = current.slots[slotIndex];
            if (!existing) {
              return current;
            }
            return setCombatantMoveSlot(
              current,
              slotIndex,
              setMoveName(existing, moveName),
            );
          })
        }
        onMoveCritChange={(slotIndex, isCrit) =>
          (isResultsSwapped ? setDefenderMoves : setAttackerMoves)((current) => {
            const existing = current.slots[slotIndex];
            if (!existing) {
              return current;
            }
            return setCombatantMoveSlot(
              current,
              slotIndex,
              setMoveCrit(existing, isCrit),
            );
          })
        }
        />
      )}

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

        <button
          type="button"
          className="battle-planner-toggle"
          onClick={() => setIsPlannerOpen((current) => !current)}
        >
          {isPlannerOpen ? 'Back to calculator' : 'Plan battle'}
        </button>

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
          availableMoves={availableMoves}
          availableSpecies={availableSpecies}
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
          availableMoves={availableMoves}
          availableSpecies={availableSpecies}
          onMovesChange={(moves) =>
            setDefenderMoves((current) => ({
              ...current,
              slots: moves,
            }))
          }
        />

        <BattleFieldControls field={field} onChange={setField} />
      </div>
    </section>
  );
}
