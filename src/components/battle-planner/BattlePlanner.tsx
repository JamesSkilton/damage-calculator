import { useMemo } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type {
  BattleCombatant,
  BattleField,
  BattlePlanAction,
  BattlePlanActor,
  BattlePlanMove,
  BattlePlanRosterEntry,
} from 'domain/index';
import { buildBattlePlanResults } from 'adapters/battlePlan';
import { buildBattleCalcBreakdowns, type BattleCalcBreakdown } from 'adapters/battleCalc';
import { calculateBattleSpeed } from 'calc-runtime';
import { chooseAiSwitchIn, predictAiMoves } from 'adapters/runAndBunAi';
import type { RankedSwitchIn } from 'ai/runAndBunAi';
import { useActiveAiProfile } from '../../nuzlocke/useActiveAiProfile';
import type { MoveOption } from '../combatant/moves/moveOptions';
import { createMoveDraft, type MoveDraft } from '../combatant/moves/moveDraft';
import SearchableTypePicker from '../combatant/shared/SearchableTypePicker';
import HpRangeBar from '../shared/HpRangeBar';
import PokemonSprite from '../shared/PokemonSprite';
import './BattlePlanner.scss';

type BattlePlannerProps = {
  generation: BattleCombatant['generation'];
  attacker: BattleCombatant;
  defender: BattleCombatant;
  field: BattleField;
  availableMoves: MoveOption[];
  attackerMoves: readonly MoveDraft[];
  defenderMoves: readonly MoveDraft[];
  attackerRoster: readonly BattlePlanRosterEntry[];
  defenderRoster: readonly BattlePlanRosterEntry[];
  attackerRosterId: string;
  defenderRosterId: string;
  actions: BattlePlanAction[];
  onActionsChange: Dispatch<SetStateAction<BattlePlanAction[]>>;
  onBack: () => void;
};

function createAction(actor: BattlePlanActor): BattlePlanAction {
  return {
    id: `${actor}-${Date.now()}-${Math.random()}`,
    actor,
    type: 'move',
    move: createMoveDraft(),
  };
}

function formatHpRange(range: { min: number; max: number }): string {
  return range.min === range.max ? `${range.min}` : `${range.min}-${range.max}`;
}

type SwitchPokemonOption = {
  name: string;
  displayName: string;
  group: string;
  types: string[];
};

function filterSwitchPokemonOptions(
  options: SwitchPokemonOption[],
  searchTerm: string,
): SwitchPokemonOption[] {
  const normalizedSearch = searchTerm.trim().toLowerCase();
  if (!normalizedSearch) {
    return options;
  }

  return options.filter((option) =>
    [option.displayName, option.group]
      .some((value) => value.toLowerCase().includes(normalizedSearch)),
  );
}

type MovePreview = {
  option: MoveOption;
  breakdown: BattleCalcBreakdown;
};

function PlannerHpRange({
  range,
  maxHp,
  label,
}: {
  range: { min: number; max: number };
  maxHp: number;
  label: string;
}) {
  if (maxHp <= 0) {
    return null;
  }

  return (
    <div className="battle-plan-hp d-grid gap-1 mt-1">
      <div className="d-flex justify-content-between gap-2 small text-secondary">
        <span>{label} remaining</span>
        <strong className="text-body fw-semibold">
          {formatHpRange(range)} / {maxHp} HP
        </strong>
      </div>
      <HpRangeBar
        min={range.min}
        max={range.max}
        maxHp={maxHp}
        label={label}
      />
    </div>
  );
}

function moveAction(
  actions: BattlePlanAction[],
  id: string,
  direction: -1 | 1,
): BattlePlanAction[] {
  const index = actions.findIndex((action) => action.id === id);
  const nextIndex = index + direction;

  if (index < 0 || nextIndex < 0 || nextIndex >= actions.length) {
    return actions;
  }

  const next = [...actions];
  [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
  return next;
}


export default function BattlePlanner({
  generation,
  attacker,
  defender,
  field,
  availableMoves,
  attackerMoves,
  defenderMoves,
  attackerRoster,
  defenderRoster,
  attackerRosterId,
  defenderRosterId,
  actions,
  onActionsChange,
  onBack,
}: BattlePlannerProps) {
  const aiProfile = useActiveAiProfile();
  const results = useMemo(
    () =>
      buildBattlePlanResults({
        generation,
        attacker,
        defender,
        field,
        actions,
        attackerRoster,
        defenderRoster,
        attackerRosterId,
        defenderRosterId,
      }),
    [actions, attacker, defender, field, generation, attackerRoster, defenderRoster, attackerRosterId, defenderRosterId],
  );

  const updateAction = (id: string, updates: { actor: BattlePlanActor; type: 'move'; move: BattlePlanMove } | { actor: BattlePlanActor; type: 'switch'; targetPokemonId: string }) => {
    onActionsChange((current) =>
      current.map((action) =>
        action.id === id
          ? { ...updates, id: action.id }
          : action,
      ),
    );
  };

  const updateMove = (id: string, updates: Partial<BattlePlanMove>) => {
    onActionsChange((current) => current.map((action) =>
      action.id === id && action.type === 'move'
        ? { ...action, move: { ...action.move, ...updates } }
        : action,
    ));
  };

  const reorderAction = (id: string, direction: -1 | 1) =>
    onActionsChange((current) => moveAction(current, id, direction));

  const resetPlan = () => onActionsChange([]);

  const getActorRoster = (actor: BattlePlanActor) =>
    actor === 'attacker' ? attackerRoster : defenderRoster;

  const getActiveRosterEntry = (actor: BattlePlanActor, index: number) => {
    const initialId = actor === 'attacker' ? attackerRosterId : defenderRosterId;
    const previous = [...results.slice(0, index)].reverse().find(
      (result) => result.action.actor === actor && result.activePokemonId,
    );
    return getActorRoster(actor).find(
      (entry) => entry.id === (previous?.activePokemonId ?? initialId),
    ) ?? getActorRoster(actor)[0];
  };

  // The first step of a turn goes to the faster active Pokémon; the second goes to the other one.
  const getNextActor = (): BattlePlanActor => {
    const last = actions.at(-1);
    if (last && actions.length % 2 === 1) {
      return last.actor === 'attacker' ? 'defender' : 'attacker';
    }

    const index = actions.length;
    const speedOf = (side: BattlePlanActor) =>
      calculateBattleSpeed({
        generation,
        combatant: getActiveRosterEntry(side, index)?.combatant ?? (side === 'attacker' ? attacker : defender),
        field,
        side,
      });
    try {
      return speedOf('defender') > speedOf('attacker') ? 'defender' : 'attacker';
    } catch {
      return last?.actor === 'attacker' ? 'defender' : 'attacker';
    }
  };

  const getActorMoveOptions = (actor: BattlePlanActor, index: number): MoveOption[] => {
    const moves = getActiveRosterEntry(actor, index)?.moves ?? (actor === 'attacker' ? attackerMoves : defenderMoves);
    const selectedNames = new Set(
      moves.map((move) => move.name.trim().toLowerCase()).filter(Boolean),
    );

    return availableMoves.filter((move) =>
      selectedNames.has(move.name.toLowerCase()),
    );
  };

  const getMovePreviews = (action: Extract<BattlePlanAction, { type: 'move' }>, index: number): MovePreview[] => {
    const activeActor = getActiveRosterEntry(action.actor, index)?.combatant ??
      (action.actor === 'attacker' ? attacker : defender);
    const targetActor = action.actor === 'attacker' ? 'defender' : 'attacker';
    const activeTarget = getActiveRosterEntry(targetActor, index)?.combatant ??
      (action.actor === 'attacker' ? defender : attacker);
    const previousResult = results[index - 1];
    const actorHp = action.actor === 'attacker'
      ? previousResult?.attackerHp.max
      : previousResult?.defenderHp.max;
    const targetHp = action.actor === 'attacker'
      ? previousResult?.defenderHp.max
      : previousResult?.attackerHp.max;
    const moveOptions = getActorMoveOptions(action.actor, index);
    const breakdowns = buildBattleCalcBreakdowns({
      generation,
      attacker: { ...activeActor, currentHp: actorHp ?? activeActor.currentHp },
      defender: { ...activeTarget, currentHp: targetHp ?? activeTarget.currentHp },
      field,
      moves: moveOptions.map((option) => ({ ...action.move, name: option.name })),
    });

    return breakdowns.flatMap((breakdown) => {
      const option = moveOptions[breakdown.slotIndex];
      return option ? [{ option, breakdown }] : [];
    });
  };

  // New defender steps start on the AI's post-KO switch-in, or else its most likely move.
  const createPlannedAction = (actor: BattlePlanActor, index = actions.length): BattlePlanAction => {
    if (actor === 'defender') {
      const [next] = getAiSwitchOrder(index);
      if (next) {
        return {
          id: `defender-${Date.now()}-${Math.random()}`,
          actor,
          type: 'switch',
          targetPokemonId: next.id,
        };
      }
    }

    const action = createAction(actor);
    if (actor !== 'defender' || action.type !== 'move') {
      return action;
    }

    const [top] = getAiPredictions(index);
    return top ? { ...action, move: { ...action.move, name: top.name } } : action;
  };

  // Defender Pokémon that a guaranteed KO has already knocked out before this step.
  const getFaintedIds = (index: number): Set<string> => {
    const fainted = new Set<string>();
    for (let step = 0; step < index; step++) {
      const result = results[step];
      if (!result?.isKo || result.error) continue;
      const victim = result.action.actor === 'attacker' ? 'defender' : 'attacker';
      const entry = getActiveRosterEntry(victim, step);
      if (entry) fainted.add(entry.id);
    }
    return fainted;
  };

  // Roster ids the AI would bring in, best first, when its active Pokémon has fainted.
  const getAiSwitchOrder = (index: number): RankedSwitchIn[] => {
    if (aiProfile !== 'run-and-bun') return [];
    const active = getActiveRosterEntry('defender', index);
    const fainted = getFaintedIds(index);
    if (!active || !fainted.has(active.id)) return [];

    const playerEntry = getActiveRosterEntry('attacker', index);
    const player = playerEntry?.combatant ?? attacker;
    const candidates = defenderRoster.filter(
      (entry) => entry.id !== active.id && !fainted.has(entry.id),
    );
    if (candidates.length === 0) return [];

    return chooseAiSwitchIn({
      generation,
      player,
      playerHp: results[index - 1]?.attackerHp.max ?? player.currentHp,
      playerMoves: (playerEntry?.moves ?? attackerMoves).map((move) => move.name),
      field,
      candidates: candidates.map((entry) => ({
        id: entry.id,
        combatant: entry.combatant,
        moves: entry.moves.map((move) => move.name),
      })),
    });
  };

  const getAiPredictions = (index: number) => {
    if (aiProfile !== 'run-and-bun') return [];
    const aiEntry = getActiveRosterEntry('defender', index);
    const playerEntry = getActiveRosterEntry('attacker', index);
    const previous = results[index - 1];
    const ai = aiEntry?.combatant ?? defender;
    const player = playerEntry?.combatant ?? attacker;
    const lastDefenderAction = [...actions].reverse().find((item) => item.actor === 'defender');
    return predictAiMoves({
      generation,
      ai,
      player,
      field,
      aiHp: previous?.defenderHp.max ?? ai.currentHp,
      playerHp: previous?.attackerHp.max ?? player.currentHp,
      aiMoves: (aiEntry?.moves ?? defenderMoves).map((move) => move.name),
      playerMoves: (playerEntry?.moves ?? attackerMoves).map((move) => move.name),
      firstTurnOut: lastDefenderAction?.type !== 'move',
    });
  };

  const getSwitchOptions = (actor: BattlePlanActor, index: number): SwitchPokemonOption[] => {
    const activeId = getActiveRosterEntry(actor, index)?.id;
    return getActorRoster(actor)
      .filter((entry) => entry.id !== activeId)
      .map((entry) => ({
        name: entry.id,
        displayName: entry.label,
        group: actor === 'attacker'
          ? entry.source === 'party' ? 'Party' : 'Box'
          : entry.source,
        types: [...entry.combatant.types],
      }))
      .sort((left, right) => {
        const groupOrder = { Party: 0, Box: 1 };
        return (groupOrder[left.group as keyof typeof groupOrder] ?? 2) -
          (groupOrder[right.group as keyof typeof groupOrder] ?? 2) ||
          left.displayName.localeCompare(right.displayName);
      });
  };

  return (
    <section className="battle-planner d-grid gap-3 p-3 border rounded-3 bg-body" aria-label="Battle planner">
      <div className="battle-planner-header d-flex justify-content-between gap-3 align-items-start">
        <div>
          <p className="battle-planner-kicker small fw-bold text-uppercase text-success mb-0">Battle planner</p>
          {aiProfile === 'run-and-bun' && (
            <span className="badge text-bg-success mt-1">
              Opponent AI: Pokémon Run &amp; Bun (1.07)
            </span>
          )}
          {!aiProfile && (
            <p className="small text-body-secondary mb-0 mt-1">
              Opponent AI: none. Enable one on the active run in the Nuzlocke
              tracker to see move predictions here.
            </p>
          )}
        </div>
        <div className="battle-planner-header-actions d-flex gap-2">
          <button type="button" className="btn btn-sm btn-outline-secondary text-nowrap" onClick={onBack}>
            Back to calculator
          </button>
          <button
            type="button"
            className="btn btn-sm btn-success text-nowrap"
            onClick={() => {
              onActionsChange((current) => [...current, createPlannedAction(getNextActor())]);
            }}
          >
            + Add action
          </button>
          <button type="button" className="btn btn-sm btn-outline-secondary text-nowrap" onClick={resetPlan}>
            Reset plan
          </button>
        </div>
      </div>

      <ol className="battle-plan-list list-unstyled m-0 p-0 d-grid gap-3">
        {actions.map((action, index) => {
          const result = results[index];
          const actorEntry = getActiveRosterEntry(action.actor, index);
          const actor = actorEntry?.combatant ?? (action.actor === 'attacker' ? attacker : defender);
          const targetEntry = getActiveRosterEntry(action.actor === 'attacker' ? 'defender' : 'attacker', index);
          const target = targetEntry?.combatant ?? (action.actor === 'attacker' ? defender : attacker);
          const resultActor = action.type === 'switch' && result?.activePokemonId
            ? getActorRoster(action.actor).find((entry) => entry.id === result.activePokemonId)?.combatant ?? actor
            : actor;
          const actorName = actorEntry?.label ?? actor.name;
          const movePreviews = action.type === 'move' ? getMovePreviews(action, index) : [];
          const aiPredictions = action.actor === 'defender' && action.type === 'move'
            ? getAiPredictions(index)
            : [];
          const topAiPrediction = aiPredictions[0];
          const selectedAiPrediction = action.type === 'move'
            ? aiPredictions.find((prediction) => prediction.name === action.move.name)
            : undefined;
          const aiSwitchOrder = action.actor === 'defender' && action.type === 'switch'
            ? getAiSwitchOrder(index)
            : [];
          const aiSwitchTop = aiSwitchOrder[0];
          const aiSwitchChoice = defenderRoster.find((entry) => entry.id === aiSwitchTop?.id);
          return (
            <li
              key={action.id}
              className={`battle-plan-row row g-2 align-items-start flex-nowrap p-2 p-sm-3 border rounded-3 bg-body-tertiary shadow-sm${result?.isKo ? ' border-success-subtle bg-success-subtle' : ''}${result?.error ? ' border-danger-subtle bg-danger-subtle' : ''}`}
            >
              <PokemonSprite
                className="battle-plan-sprite col-auto align-self-center"
                name={actor.species || actor.name}
                alt={actor.name || actor.species}
              />
              <div className="battle-plan-action col d-flex flex-nowrap align-items-start gap-2">
                <div className="d-flex flex-column gap-2">
                <label className="d-grid flex-shrink-0 small fw-semibold text-secondary">
                  <span>Actor</span>
                  <select
                    value={action.actor}
                    onChange={(event) => {
                      const actor = event.target.value as BattlePlanActor;
                      if (action.type === 'move') {
                        const planned = !action.move.name && actor === 'defender' ? createPlannedAction(actor, index) : undefined;
                        updateAction(action.id, { actor, type: 'move', move: planned?.type === 'move' ? planned.move : action.move });
                      } else {
                        updateAction(action.id, { actor, type: 'switch', targetPokemonId: action.targetPokemonId });
                      }
                    }}
                    className="form-select form-select-sm"
                  >
                    <option value="attacker">Attacker: {getActiveRosterEntry('attacker', index)?.label || attacker.name}</option>
                    <option value="defender">Defender: {getActiveRosterEntry('defender', index)?.label || defender.name}</option>
                  </select>
                </label>
                <label className="d-grid flex-shrink-0 small fw-semibold text-secondary">
                  <span>Action</span>
                  <select
                    value={action.type}
                    onChange={(event) => {
                      if (event.target.value === 'switch') {
                        const activeId = getActiveRosterEntry(action.actor, index)?.id;
                        const targetId = getActorRoster(action.actor).find((entry) => entry.id !== activeId)?.id ?? activeId ?? '';
                        updateAction(action.id, { actor: action.actor, type: 'switch', targetPokemonId: targetId });
                      } else {
                        updateAction(action.id, { actor: action.actor, type: 'move', move: createMoveDraft() });
                      }
                    }}
                    className="form-select form-select-sm"
                  >
                    <option value="move">Move</option>
                    <option value="switch">Switch</option>
                  </select>
                </label>
                    </div>
                {action.type === 'switch' ? (
                  <label className="col d-grid small fw-semibold text-secondary">
                    <span>Switch to</span>
                    {aiSwitchChoice && (
                      <span className="small fw-normal text-success mt-1" role="status">
                        Run &amp; Bun AI would send in {aiSwitchChoice.label}
                        {aiSwitchTop ? ` because ${aiSwitchTop.reason}` : ''}
                        {action.targetPokemonId === aiSwitchChoice.id ? '. Pre-selected.' : '.'}
                      </span>
                    )}
                    <SearchableTypePicker
                      value={action.targetPokemonId}
                      options={getSwitchOptions(action.actor, index)}
                      onSelect={(targetPokemonId) =>
                        updateAction(action.id, {
                          actor: action.actor,
                          type: 'switch',
                          targetPokemonId,
                        })
                      }
                      ariaLabel={`Plan step ${index + 1} switch target`}
                      placeholder="— Select Pokémon —"
                      filterOptions={filterSwitchPokemonOptions}
                      getTypes={(option) => option.types}
                      getDisplayName={(option) => option.displayName}
                      getGroup={(option) => option.group}
                      emptyMessage="No switch targets found"
                    />
                  </label>
                ) : (
                  <>
                    <div className="col d-grid small fw-semibold text-secondary" role="group" aria-label="Move">
                      <span>Move</span>
                      {topAiPrediction && (
                        <span className="small fw-normal text-success mt-1" role="status">
                          Run &amp; Bun AI suggests {topAiPrediction.name}
                          {' '}({Math.round(topAiPrediction.chance * 100)}%).
                          {action.move.name === topAiPrediction.name
                            ? ' Pre-selected.'
                            : selectedAiPrediction
                              ? ` ${action.move.name} has a ${Math.round(selectedAiPrediction.chance * 100)}% chance.`
                              : ''}
                        </span>
                      )}
                      {movePreviews.length > 0 && (
                        <div className="battle-plan-move-previews d-flex flex-nowrap w-100 gap-1 mt-1" aria-label="Move damage previews">
                          {movePreviews.map(({ option, breakdown }) => {
                            const details = breakdown.details;
                            const isSelected = action.move.name === option.name;
                            return (
                              <button
                                key={option.name}
                                type="button"
                                className={`battle-plan-move-preview btn btn-sm d-grid gap-1 text-start fw-normal${isSelected ? ' btn-success' : ' btn-outline-secondary text-body'}`}
                                aria-pressed={isSelected}
                                onClick={() => updateMove(action.id, { name: option.name })}
                              >
                                <span className={`d-flex justify-content-between gap-2 small${isSelected ? ' text-white' : ''}`}>
                                  <strong>{option.name}</strong>
                                  <span className={`fw-normal${isSelected ? ' text-white' : ' text-body'}`}>{option.category} · {option.basePower > 0 ? `${option.basePower} BP` : 'Status'}</span>
                                </span>
                                <strong className={isSelected ? 'text-white' : 'text-success'}>
                                  {breakdown.error ? 'Unavailable' : breakdown.result?.rangeText ?? 'Unavailable'}
                                </strong>
                                {details && (
                                  <span className={`d-block small fw-normal lh-sm${isSelected ? ' text-white' : ' text-body'}`}>
                                    {details.percentRange.min.toFixed(1)}-{details.percentRange.max.toFixed(1)}% dmg · Avg {details.averageDamage.toFixed(1)}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <div className="d-flex flex-column gap-2 h-100">
                      <label className="d-flex align-items-center gap-1 text-nowrap">
                        <input type="checkbox" checked={action.move.isCrit} onChange={(event) => updateMove(action.id, { isCrit: event.target.checked })} />
                        Crit
                      </label>
                      <label className="d-flex align-items-center gap-1 text-nowrap">
                        <input className="form-control form-control-sm" type="number" min="1" max="8" value={action.move.hits} onChange={(event) => updateMove(action.id, { hits: Number(event.target.value) || 1 })} />
                        <span>Hits</span>
                      </label>
                      <label className="d-flex align-items-center gap-1 text-nowrap">
                        <input type="checkbox" checked={Boolean(action.move.useZ)} disabled={generation < 7} onChange={(event) => updateMove(action.id, { useZ: event.target.checked, useMax: event.target.checked ? false : action.move.useMax })} />
                        Z
                      </label>
                      <label className="d-flex align-items-center gap-1 text-nowrap">
                        <input type="checkbox" checked={Boolean(action.move.useMax)} disabled={generation < 8} onChange={(event) => updateMove(action.id, { useMax: event.target.checked, useZ: event.target.checked ? false : action.move.useZ })} />
                        Max
                      </label>
                    </div>
                  </>
                )}
                <div className="d-flex flex-column align-items-center gap-1 text-nowrap">
                  <div className="battle-plan-order d-flex flex-column gap-1" aria-label={`Reorder plan step ${index + 1}`}>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary p-0"
                      onClick={() => reorderAction(action.id, -1)}
                      disabled={index === 0}
                      aria-label={`Move plan step ${index + 1} up`}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary p-0"
                      onClick={() => reorderAction(action.id, 1)}
                      disabled={index === actions.length - 1}
                      aria-label={`Move plan step ${index + 1} down`}
                    >
                      ↓
                    </button>
                  </div>
                  <button
                    type="button"
                    className="battle-plan-remove btn btn-sm btn-outline-danger d-flex align-items-center justify-content-center p-0"
                    onClick={() => onActionsChange((current) => current.filter((item) => item.id !== action.id))}
                    aria-label={`Remove plan step ${index + 1}`}
                  >
                    ×
                  </button>
                </div>
              </div>
              <div className="battle-plan-result col-auto text-body-secondary">
                <div className="battle-plan-result-copy d-grid gap-1">
                  <strong className="text-body fs-6">{result?.error ? result.error : action.type === 'switch' ? `Switched to ${result?.activePokemonLabel ?? 'Pokemon'} (0 damage)` : result?.isKo ? 'KO' : `${result?.damage.min ?? 0}-${result?.damage.max ?? 0} damage`}</strong>
                  {result && !result.error && (
                    <span className="small lh-sm">
                      {actorName} → {result.isKo ? 'KO' : action.actor === 'attacker'
                        ? `Defender ${formatHpRange(result.defenderHp)} HP`
                        : `Attacker ${formatHpRange(result.attackerHp)} HP`}
                    </span>
                  )}
                </div>
                {result && !result.error && (
                  <>
                    <PlannerHpRange
                      range={result.targetHp}
                      maxHp={result.targetMaxHp}
                      label={action.type === 'switch' ? result.activePokemonLabel ?? 'Pokemon' : action.actor === 'attacker' ? 'Defender' : 'Attacker'}
                    />
                    <PokemonSprite
                      className="battle-plan-result-sprite"
                      name={(action.type === 'switch' ? resultActor : target).species || (action.type === 'switch' ? resultActor : target).name}
                      alt={(action.type === 'switch' ? resultActor : target).name || (action.type === 'switch' ? resultActor : target).species}
                    />
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ol>

    </section>
  );
}