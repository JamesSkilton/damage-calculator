import { useMemo } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type {
  BattleCombatant,
  BattleField,
  BattlePlanAction,
  BattlePlanActor,
  BattlePlanMove,
  BattlePlanRosterEntry,
  BattlePlanResidual,
  BattlePlanStateAction,
} from 'domain/index';
import { buildBattlePlanResults } from 'adapters/battlePlan';
import { buildBattleCalcBreakdowns, type BattleCalcBreakdown } from 'adapters/battleCalc';
import { calculateBattleSpeed } from 'calc-runtime';
import { chooseAiSwitchIn, predictAiMoves } from 'adapters/runAndBunAi';
import { getMovePriority } from 'adapters/movePriority';
import type { RankedSwitchIn } from 'ai/runAndBunAi';
import { useActiveAiProfile } from '../../nuzlocke/useActiveAiProfile';
import type { BattleStatId, BattleStatusName, BattleTerrain, BattleWeather } from 'domain/shared';
import type { MoveOption } from '../combatant/moves/moveOptions';
import { createMoveDraft, type MoveDraft } from '../combatant/moves/moveDraft';
import SearchableTypePicker from '../combatant/shared/SearchableTypePicker';
import HpRangeBar, { type HpRangeBarLoss } from '../shared/HpRangeBar';
import PokemonSprite from '../shared/PokemonSprite';
import HeldItemOverlay from '../shared/HeldItemOverlay';
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

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

const STATUS_OPTIONS: { value: BattleStatusName; label: string }[] = [
  { value: 'slp', label: 'Asleep' },
  { value: 'psn', label: 'Poisoned' },
  { value: 'tox', label: 'Badly poisoned' },
  { value: 'brn', label: 'Burned' },
  { value: 'frz', label: 'Frozen' },
  { value: 'par', label: 'Paralyzed' },
];
const WEATHER_OPTIONS: BattleWeather[] = ['Sun', 'Rain', 'Sand', 'Hail', 'Snow', 'Harsh Sunshine', 'Heavy Rain', 'Strong Winds'];
const TERRAIN_OPTIONS: BattleTerrain[] = ['Electric', 'Grassy', 'Psychic', 'Misty'];
const BOOST_STATS: { id: Exclude<BattleStatId, 'hp'>; label: string }[] = [
  { id: 'atk', label: 'Atk' },
  { id: 'def', label: 'Def' },
  { id: 'spa', label: 'SpA' },
  { id: 'spd', label: 'SpD' },
  { id: 'spe', label: 'Spe' },
];

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

const LOSS_KIND: Record<string, string> = {
  burn: 'burn',
  poison: 'poison',
  toxic: 'poison',
  sandstorm: 'weather',
  hail: 'cold',
};

function toLosses(residual: BattlePlanResidual | undefined): HpRangeBarLoss[] {
  return (residual?.parts ?? [])
    .filter((part) => part.amount > 0)
    .map((part) => ({ label: part.source, amount: part.amount, kind: LOSS_KIND[part.source] ?? 'item' }));
}

function toGains(residual: BattlePlanResidual | undefined): HpRangeBarLoss[] {
  return (residual?.parts ?? [])
    .filter((part) => part.berry)
    .map((part) => ({ label: part.source, amount: -part.amount, kind: 'berry' }));
}

function PlannerHpRange({
  range,
  maxHp,
  label,
  losses = [],
  gains = [],
}: {
  range: { min: number; max: number };
  maxHp: number;
  label: string;
  losses?: readonly HpRangeBarLoss[];
  gains?: readonly HpRangeBarLoss[];
}) {
  if (maxHp <= 0) {
    return null;
  }

  return (
    <div className="battle-plan-hp d-grid gap-1 mt-1">
      <div className="d-flex justify-content-between gap-2 small text-secondary">
        <span>{label} remaining</span>
        <strong className="text-body fw-semibold">
          {range.min === 0 && range.max > 0 && <span className="badge text-bg-warning me-2">Can KO</span>}
          {range.max === 0 && <span className="badge text-bg-danger me-2">KO</span>}
          {formatHpRange(range)} / {maxHp} HP
        </strong>
      </div>
      <HpRangeBar
        min={range.min}
        max={range.max}
        maxHp={maxHp}
        label={label}
        losses={losses}
        gains={gains}
        showScale
      />
      {gains.length > 0 && (
        <div className="d-flex flex-wrap gap-1">
          {gains.map((gain) => (
            <span key={gain.label} className="small d-inline-flex align-items-center gap-1">
              <span className={`hp-range-bar hp-range-bar-gain-${gain.kind} d-inline-block`} style={{ width: '0.6rem' }} />
              {gain.label} +{gain.amount}
            </span>
          ))}
        </div>
      )}
      {losses.length > 0 && (
        <div className="d-flex flex-wrap gap-1">
          {losses.map((loss) => (
            <span key={loss.label} className="small d-inline-flex align-items-center gap-1">
              <span className={`hp-range-bar hp-range-bar-loss-${loss.kind} d-inline-block`} style={{ width: '0.6rem' }} />
              {loss.label} -{loss.amount}
            </span>
          ))}
        </div>
      )}
    </div>
  );
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

  // Field and status in effect before the given step, including any "Set state" corrections.
  const fieldBefore = (index: number): BattleField => results[index - 1]?.field ?? field;
  const withStatus = (entry: BattlePlanRosterEntry | undefined, fallback: BattleCombatant, index: number): BattleCombatant => {
    const combatant = entry?.combatant ?? fallback;
    const statuses = results[index - 1]?.statuses;
    const boosts = results[index - 1]?.boosts;
    const next = entry && statuses && entry.id in statuses ? { ...combatant, status: statuses[entry.id] } : combatant;
    const held = entry && results[index - 1]?.items[entry.id] === 'consumed' ? { ...next, item: undefined } : next;
    const unburden = entry && held.ability === 'Unburden' && results[index - 1]
      ? { ...held, abilityOn: results[index - 1].unburdenActive[entry.id] ?? false }
      : held;
    return entry && boosts?.[entry.id] ? { ...unburden, boosts: boosts[entry.id] } : unburden;
  };

  const updateAction = (id: string, updates: DistributiveOmit<BattlePlanAction, 'id'>) => {
    onActionsChange((current) =>
      current.map((action) =>
        action.id === id
          ? { ...updates, id: action.id }
          : action,
      ),
    );
  };

  // HP/stat corrections made from a turn's bar live in one hidden "Set state" step per side,
  // placed after the turn's actions and before its end-of-turn tick.
  const setTurnState = (
    turn: { stepIndices: number[]; summaryIndex?: number },
    side: BattlePlanActor,
    updates: Partial<Pick<BattlePlanStateAction, 'hp' | 'boosts' | 'status' | 'weather' | 'terrain'>>,
  ) => {
    onActionsChange((current) => {
      const existing = turn.stepIndices
        .map((index) => actions[index])
        .find((item): item is BattlePlanStateAction => item.type === 'state' && item.source === 'turn' && item.actor === side);
      const base: BattlePlanStateAction = existing ?? {
        id: `state-${Date.now()}-${Math.random()}`,
        actor: side,
        type: 'state',
        source: 'turn',
      };
      const next = { ...base, ...updates };
      const empty = next.hp === undefined && !next.boosts && !next.status && !next.weather && !next.terrain;
      if (existing) {
        return empty
          ? current.filter((item) => item.id !== existing.id)
          : current.map((item) => (item.id === existing.id ? next : item));
      }
      if (empty) return current;
      const anchorId = turn.summaryIndex !== undefined
        ? actions[turn.summaryIndex].id
        : actions[turn.stepIndices.at(-1)!].id;
      const anchor = current.findIndex((item) => item.id === anchorId);
      const insertAt = turn.summaryIndex !== undefined ? anchor : anchor + 1;
      return [...current.slice(0, insertAt), next, ...current.slice(insertAt)];
    });
  };

  // Within a turn, the higher-priority move (or any switch) goes first; equal priority falls back to speed.
  const orderTurnByPriority = (list: BattlePlanAction[], changedId: string): BattlePlanAction[] => {
    const changedAt = list.findIndex((item) => item.id === changedId);
    if (changedAt < 0) return list;
    let start = changedAt;
    while (start > 0 && list[start - 1].type !== 'end-turn') start--;
    let end = changedAt;
    while (end + 1 < list.length && list[end + 1].type !== 'end-turn') end++;
    const slots = [];
    for (let i = start; i <= end; i++) {
      if (list[i].type === 'move' || list[i].type === 'switch') slots.push(i);
    }
    if (slots.length !== 2) return list;

    const [a, b] = slots;
    const first = list[a];
    const second = list[b];
    if (first.actor === second.actor) return list;

    const priorityOf = (action: BattlePlanAction) =>
      action.type === 'switch' ? 100 : action.type === 'move' && action.move.name && !action.move.skipped ? getMovePriority(generation, action.move.name) : 0;
    const speedOf = (side: BattlePlanActor) => {
      try {
        return calculateBattleSpeed({
          generation,
          combatant: withStatus(getActiveRosterEntry(side, start), side === 'attacker' ? attacker : defender, start),
          field: fieldBefore(start),
          side,
        });
      } catch {
        return 0;
      }
    };

    const diff = priorityOf(second) - priorityOf(first) || speedOf(second.actor) - speedOf(first.actor);
    if (diff <= 0) return list;
    const next = [...list];
    next[a] = second;
    next[b] = first;
    return next;
  };

  const updateMove = (id: string, updates: Partial<BattlePlanMove>) => {
    onActionsChange((current) => {
      const next = current.map((action) =>
        action.id === id && action.type === 'move'
          ? { ...action, move: { ...action.move, ...updates } }
          : action,
      );
      return updates.name !== undefined || updates.skipped !== undefined ? orderTurnByPriority(next, id) : next;
    });
  };

  const plannerStatusOf = (actor: BattlePlanActor, index: number): BattleStatusName | undefined => {
    const entry = getActiveRosterEntry(actor, index);
    const statuses = results[index - 1]?.statuses;
    return entry && statuses && entry.id in statuses ? statuses[entry.id] : entry?.combatant.status;
  };

  const statusLabel = (status: BattleStatusName | undefined): string =>
    STATUS_OPTIONS.find((option) => option.value === status)?.label ?? '';

  const reorderTurn = (turnIndex: number, direction: -1 | 1) =>
    onActionsChange((current) => {
      const target = turnIndex + direction;
      if (target < 0 || target >= turns.length) return current;
      const byId = new Map(current.map((item) => [item.id, item]));
      // End-of-turn markers stay in their slots so an open (unclosed) turn is never merged into its neighbour.
      const slots = turns.map((turn) => ({
        body: turn.stepIndices.filter((index) => actions[index].type !== 'end-turn').map((index) => actions[index].id),
        end: turn.summaryIndex !== undefined ? actions[turn.summaryIndex].id : undefined,
      }));
      [slots[turnIndex].body, slots[target].body] = [slots[target].body, slots[turnIndex].body];
      return slots
        .flatMap((slot) => [...slot.body, ...(slot.end ? [slot.end] : [])])
        .map((id) => byId.get(id))
        .filter((item): item is BattlePlanAction => Boolean(item));
    });

  // Turns are derived: each "End of turn" step closes the turn it belongs to.
  const turnNumbers = actions.reduce<number[]>((numbers, _action, index) => {
    const previous = index === 0 ? 1 : numbers[index - 1] + (actions[index - 1].type === 'end-turn' ? 1 : 0);
    numbers.push(previous);
    return numbers;
  }, []);
  const turns = actions.reduce<{ number: number; stepIndices: number[]; summaryIndex?: number }[]>((groups, action, index) => {
    const open = groups.at(-1);
    if (!open || open.summaryIndex !== undefined) {
      groups.push({ number: turnNumbers[index], stepIndices: [], summaryIndex: undefined });
    }
    const current = groups.at(-1)!;
    if (action.type === 'end-turn') current.summaryIndex = index;
    else current.stepIndices.push(index);
    return groups;
  }, []);

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
    const lastEndTurn = actions.map((item) => item.type).lastIndexOf('end-turn');
    const turnActions = actions
      .slice(lastEndTurn + 1)
      .filter((item) => item.type === 'move' || item.type === 'switch');
    const last = turnActions.at(-1);
    if (last && turnActions.length % 2 === 1) {
      return last.actor === 'attacker' ? 'defender' : 'attacker';
    }

    const index = actions.length;
    const speedOf = (side: BattlePlanActor) =>
      calculateBattleSpeed({
        generation,
        combatant: withStatus(getActiveRosterEntry(side, index), side === 'attacker' ? attacker : defender, index),
        field: fieldBefore(index),
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
    const activeActor = withStatus(getActiveRosterEntry(action.actor, index), action.actor === 'attacker' ? attacker : defender, index);
    const targetActor = action.actor === 'attacker' ? 'defender' : 'attacker';
    const activeTarget = withStatus(getActiveRosterEntry(targetActor, index), action.actor === 'attacker' ? defender : attacker, index);
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
      field: fieldBefore(index),
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
      if (result.action.type === 'end-turn') {
        for (const side of ['attacker', 'defender'] as const) {
          const hp = side === 'attacker' ? result.attackerHp : result.defenderHp;
          const entry = getActiveRosterEntry(side, step);
          if (hp.max === 0 && entry) fainted.add(entry.id);
        }
        continue;
      }
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
    const player = withStatus(playerEntry, attacker, index);
    const candidates = defenderRoster.filter(
      (entry) => entry.id !== active.id && !fainted.has(entry.id),
    );
    if (candidates.length === 0) return [];

    return chooseAiSwitchIn({
      generation,
      player,
      playerHp: results[index - 1]?.attackerHp.max ?? player.currentHp,
      playerMoves: (playerEntry?.moves ?? attackerMoves).map((move) => move.name),
      field: fieldBefore(index),
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
    const ai = withStatus(aiEntry, defender, index);
    const player = withStatus(playerEntry, attacker, index);
    const lastDefenderAction = [...actions].reverse().find((item) => item.actor === 'defender');
    return predictAiMoves({
      generation,
      ai,
      player,
      field: fieldBefore(index),
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
      <div className="battle-planner-header sticky-top bg-body py-2 border-bottom d-flex justify-content-between gap-3 align-items-start">
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
              // Adds the whole turn: the faster side first, then the other, then closes the turn.
              const lastEndTurn = actions.map((item) => item.type).lastIndexOf('end-turn');
              const turnActions = actions.slice(lastEndTurn + 1).filter((item) => item.type === 'move' || item.type === 'switch');
              const first = getNextActor();
              const added: BattlePlanAction[] = [];
              if (turnActions.length === 0) {
                added.push(createPlannedAction(first), createPlannedAction(first === 'attacker' ? 'defender' : 'attacker'));
              } else if (turnActions.length === 1) {
                added.push(createPlannedAction(first));
              } else {
                added.push(createPlannedAction(first), createPlannedAction(first === 'attacker' ? 'defender' : 'attacker'));
              }
              added.push({ id: `end-turn-${Date.now()}-${Math.random()}`, actor: 'attacker', type: 'end-turn' });
              onActionsChange((current) => [...current, ...added]);
            }}
          >
            + Add action
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline-success text-nowrap"
            onClick={() => onActionsChange((current) => [
              ...current,
              { id: `end-turn-${Date.now()}-${Math.random()}`, actor: 'attacker', type: 'end-turn' },
            ])}
          >
            + End of turn
          </button>
          <button type="button" className="btn btn-sm btn-outline-secondary text-nowrap" onClick={resetPlan}>
            Reset plan
          </button>
        </div>
      </div>

      <ol className="battle-plan-list list-unstyled m-0 p-0 d-grid gap-3">
        {turns.map((turn, turnIndex) => (
          <li key={turn.number} className="battle-plan-turn border rounded-3 overflow-hidden shadow-sm" aria-label={`Turn ${turn.number}`}>
            <div className="d-flex align-items-center gap-2 px-3 py-2 bg-dark text-white">
              <strong className="me-auto">Turn {turn.number}</strong>
              <button
                type="button"
                className="battle-plan-turn-action btn btn-sm btn-outline-light"
                onClick={() => reorderTurn(turnIndex, -1)}
                disabled={turnIndex === 0}
                aria-label={`Move turn ${turn.number} up`}
              >
                ↑
              </button>
              <button
                type="button"
                className="battle-plan-turn-action btn btn-sm btn-outline-light"
                onClick={() => reorderTurn(turnIndex, 1)}
                disabled={turnIndex === turns.length - 1}
                aria-label={`Move turn ${turn.number} down`}
              >
                ↓
              </button>
              <button
                type="button"
                className="battle-plan-turn-action btn btn-sm btn-outline-danger"
                onClick={() => {
                  const ids = new Set(turn.stepIndices.map((index) => actions[index].id));
                  if (turn.summaryIndex !== undefined) ids.add(actions[turn.summaryIndex].id);
                  onActionsChange((current) => current.filter((item) => !ids.has(item.id)));
                }}
                aria-label={`Remove turn ${turn.number}`}
                title="Remove turn"
              >
                ×
              </button>
            </div>
            <div className="battle-plan-turn-steps p-2 p-sm-3">
              {turn.stepIndices
                .filter((index) => {
                  const step = actions[index];
                  return !(step.type === 'state');
                })
                .map((index) => renderStep(actions[index], index))}
            </div>
            {renderTurnFooter(turn)}
          </li>
        ))}
      </ol>

    </section>
  );

  // One bar per turn: each action's outcome, then end-of-turn residuals, then one HP bar per side.
  function renderTurnFooter(turn: { number: number; stepIndices: number[]; summaryIndex?: number }) {
    const summary = turn.summaryIndex !== undefined ? results[turn.summaryIndex] : undefined;
    const lastIndex = turn.summaryIndex ?? turn.stepIndices.at(-1);
    const lastActionIndex = turn.stepIndices.filter((index) => {
      const step = actions[index];
      return !(step.type === 'state');
    }).at(-1);
    const last = lastIndex !== undefined ? results[lastIndex] : undefined;
    if (!last) return null;

    const lines = turn.stepIndices.map((index) => ({ action: actions[index], step: results[index] }));

    // Max HP is only known for a side once it has been the target of a step.
    const maxHpFor = (side: BattlePlanActor): number => {
      const known = last.maxHp[side];
      if (known) return known;
      const residualMax = summary?.residual?.[side]?.maxHp;
      if (residualMax) return residualMax;
      for (const { action, step } of [...lines].reverse()) {
        if (step && !step.error && step.targetMaxHp > 0 && (action.type === 'move' ? action.actor !== side : action.actor === side)) {
          return step.targetMaxHp;
        }
      }
      return 0;
    };

    return (
      <div className="battle-plan-summary d-flex align-items-start gap-3 p-2 p-sm-3 border-top bg-body-tertiary">
        <div className="flex-grow-1 d-grid gap-2">
          <div className="d-flex flex-wrap align-items-end gap-2 small fw-semibold text-secondary" role="group" aria-label={`Turn ${turn.number} field`}>
            {([
              { key: 'weather', label: 'Weather', options: WEATHER_OPTIONS, current: last.field.weather },
              { key: 'terrain', label: 'Terrain', options: TERRAIN_OPTIONS, current: last.field.terrain },
            ] as const).map(({ key, label, options, current }) => {
              const attackerState = turn.stepIndices
                .map((index) => actions[index])
                .find((item): item is BattlePlanStateAction => item.type === 'state' && item.source === 'turn' && item.actor === 'attacker');
              return (
                <label key={key} className="d-grid">
                  <span>{label}</span>
                  <select
                    className="form-select form-select-sm"
                    value={attackerState?.[key] ?? ''}
                    aria-label={`Turn ${turn.number} ${key}`}
                    onChange={(event) => setTurnState(turn, 'attacker', { [key]: (event.target.value || undefined) as BattlePlanStateAction[typeof key] })}
                  >
                    <option value="">{attackerState?.[key] === undefined && current ? current : '—'}</option>
                    <option value="none">None</option>
                    {options.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
              );
            })}
          </div>
          {(() => {
            const itemEvents = [...turn.stepIndices, ...(turn.summaryIndex !== undefined ? [turn.summaryIndex] : [])]
              .flatMap((index) => results[index]?.itemEvents ?? []);
            return itemEvents.length > 0 && (
              <ul className="list-unstyled small mb-0 d-grid gap-1" aria-label={`Turn ${turn.number} item effects`}>
                {itemEvents.map((event, eventIndex) => (
                  <li key={`${eventIndex}-${event}`} className="text-secondary">{event}</li>
                ))}
              </ul>
            );
          })()}
          <div className="battle-plan-summary-sides">
            {(['attacker', 'defender'] as const).map((side) => {
              const hp = side === 'attacker' ? last.attackerHp : last.defenderHp;
              const maxHp = maxHpFor(side);
              const label = summary?.residual?.[side]?.label ?? getActiveRosterEntry(side, lastIndex!)?.label ?? side;
              if (maxHp <= 0) return null;
              return (
                <div key={side} className="small p-2 border rounded-2 bg-body">
                  <PlannerHpRange range={hp} maxHp={maxHp} label={label} losses={toLosses(summary?.residual?.[side])} gains={toGains(summary?.residual?.[side])} />
                  {lastActionIndex !== undefined && (() => {
                    const turnState = turn.stepIndices
                      .map((index) => actions[index])
                      .find((item): item is BattlePlanStateAction => item.type === 'state' && item.source === 'turn' && item.actor === side);
                    const predicted = (side === 'attacker' ? results[lastActionIndex].attackerHp : results[lastActionIndex].defenderHp).max;
                    const stageResult = results[lastIndex!]?.boosts[getActiveRosterEntry(side, lastIndex!)?.id ?? ''];
                    const currentStatus = results[lastIndex!]?.statuses[getActiveRosterEntry(side, lastIndex!)?.id ?? ''];
                    return (
                      <details className="mt-2" open={Boolean(turnState)}>
                        <summary className="small fw-semibold text-secondary">
                          Adjust HP &amp; stats{turnState ? ' ✓' : ''}
                        </summary>
                        <div className="d-flex flex-wrap align-items-end gap-2 mt-2">
                          <label className="d-grid small fw-semibold text-secondary">
                            <span>HP</span>
                            <input
                              className="form-control form-control-sm battle-plan-number"
                              type="number"
                              min="0"
                              max={maxHp}
                              value={turnState?.hp ?? ''}
                              placeholder={`${predicted}`}
                              aria-label={`Turn ${turn.number} ${side} actual HP`}
                              onChange={(event) => setTurnState(turn, side, {
                                hp: event.target.value === '' ? undefined : Math.max(0, Math.floor(Number(event.target.value)) || 0),
                              })}
                            />
                          </label>
                          <label className="d-grid small fw-semibold text-secondary">
                            <span>Status</span>
                            <select
                              className="form-select form-select-sm"
                              value={turnState?.status ?? ''}
                              aria-label={`Turn ${turn.number} ${side} status`}
                              onChange={(event) => setTurnState(turn, side, { status: (event.target.value || undefined) as BattlePlanStateAction['status'] })}
                            >
                              <option value="">{turnState?.status === undefined && currentStatus ? `${currentStatus}` : '—'}</option>
                              <option value="none">None</option>
                              {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                            </select>
                          </label>
                          {BOOST_STATS.map(({ id, label: statLabel }) => (
                            <label key={id} className="d-grid small fw-semibold text-secondary">
                              <span>{statLabel}</span>
                              <select
                                className="form-select form-select-sm"
                                value={turnState?.boosts?.[id] ?? ''}
                                aria-label={`Turn ${turn.number} ${side} ${statLabel} stage`}
                                onChange={(event) => {
                                  const rest = { ...turnState?.boosts };
                                  delete rest[id];
                                  const boosts = event.target.value === '' ? rest : { ...rest, [id]: Number(event.target.value) };
                                  setTurnState(turn, side, { boosts: Object.keys(boosts).length > 0 ? boosts : undefined });
                                }}
                              >
                                <option value="">{turnState?.boosts?.[id] === undefined && stageResult?.[id] ? `${stageResult[id]! > 0 ? '+' : ''}${stageResult[id]}` : '—'}</option>
                                {Array.from({ length: 13 }, (_, i) => i - 6).map((stage) => (
                                  <option key={stage} value={stage}>{stage > 0 ? `+${stage}` : stage}</option>
                                ))}
                              </select>
                            </label>
                          ))}
                        </div>
                      </details>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  function renderStep(action: BattlePlanAction, index: number) {
          const result = results[index];
          const actorEntry = getActiveRosterEntry(action.actor, index);
          const actor = actorEntry?.combatant ?? (action.actor === 'attacker' ? attacker : defender);
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
          if (action.type === 'end-turn' || action.type === 'state') {
            return null;
          }
          return (
            <div
              key={action.id}
              className={`battle-plan-row battle-plan-step row g-2 align-items-start flex-wrap p-2 p-sm-3 border rounded-3 bg-body-tertiary${result?.isKo ? ' border-success-subtle bg-success-subtle' : ''}${result?.canKo && !result.error ? ' border-warning bg-warning-subtle' : ''}${result?.error ? ' border-danger-subtle bg-danger-subtle' : ''}`}
            >
              <div className="position-relative col-auto align-self-center">
                <PokemonSprite
                  className="battle-plan-sprite"
                  name={actor.species || actor.name}
                  alt={actor.name || actor.species}
                />
                {actor.item && actorEntry && (
                  <HeldItemOverlay item={actor.item} state={result?.items[actorEntry.id] ?? 'held'} />
                )}
              </div>
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
                    value={action.type === 'move' && action.move.skipped ? 'skip' : action.type}
                    onChange={(event) => {
                      if (event.target.value === 'switch') {
                        const activeId = getActiveRosterEntry(action.actor, index)?.id;
                        const targetId = getActorRoster(action.actor).find((entry) => entry.id !== activeId)?.id ?? activeId ?? '';
                        updateAction(action.id, { actor: action.actor, type: 'switch', targetPokemonId: targetId });
                      } else if (event.target.value === 'skip') {
                        if (action.type === 'move') updateMove(action.id, { skipped: true });
                        else updateAction(action.id, { actor: action.actor, type: 'move', move: { ...createMoveDraft(), skipped: true } });
                      } else if (action.type === 'move') {
                        updateMove(action.id, { skipped: false });
                      } else {
                        updateAction(action.id, { actor: action.actor, type: 'move', move: createMoveDraft() });
                      }
                    }}
                    className="form-select form-select-sm"
                  >
                    <option value="move">Move</option>
                    <option value="skip">
                      {plannerStatusOf(action.actor, index)
                        ? `No move (${statusLabel(plannerStatusOf(action.actor, index))})`
                        : 'No move'}
                    </option>
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
                            const isSelected = action.move.name === option.name && !action.move.skipped;
                            return (
                              <button
                                key={option.name}
                                type="button"
                                className={`battle-plan-move-preview btn btn-sm d-grid gap-1 text-start fw-normal${isSelected ? ' btn-success' : ' btn-outline-secondary text-body'}`}
                                aria-pressed={isSelected}
                                onClick={() => updateMove(action.id, { name: option.name, skipped: false })}
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
              </div>
            </div>
          );
  }
}
