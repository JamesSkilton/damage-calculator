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
import type { MoveOption } from '../combatant/moves/moveOptions';
import { createMoveDraft, type MoveDraft } from '../combatant/moves/moveDraft';
import SearchableMovePicker from '../combatant/moves/SearchableMovePicker';
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

function PlannerHpRange({
  range,
  maxHp,
  label,
  sprite,
}: {
  range: { min: number; max: number };
  maxHp: number;
  label: string;
  sprite: BattleCombatant;
}) {
  if (maxHp <= 0) {
    return null;
  }

  return (
    <div className="battle-plan-hp">
      <PokemonSprite
        className="battle-plan-hp-sprite"
        name={sprite.species || sprite.name}
        alt={sprite.name || sprite.species}
      />
      <div className="battle-plan-hp-header">
        <span>{label} remaining</span>
        <strong>
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

  const resetPlan = () => onActionsChange([createAction('attacker')]);

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

  const getActorMoveOptions = (actor: BattlePlanActor, index: number): MoveOption[] => {
    const moves = getActiveRosterEntry(actor, index)?.moves ?? (actor === 'attacker' ? attackerMoves : defenderMoves);
    const selectedNames = new Set(
      moves.map((move) => move.name.trim().toLowerCase()).filter(Boolean),
    );

    return availableMoves.filter((move) =>
      selectedNames.has(move.name.toLowerCase()),
    );
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
    <section className="battle-planner" aria-label="Battle planner">
      <div className="battle-planner-header">
        <div>
          <p className="battle-planner-kicker">Sequence planner</p>
          <h2>Plan the exchange</h2>
          <p>
            Stack actions in order to see how damage ranges carry through the
            battle.
          </p>
        </div>
        <div className="d-flex gap-2">
          <button type="button" className="battle-planner-reset" onClick={onBack}>
            Back to calculator
          </button>
          <button
            type="button"
            className="battle-planner-add"
            onClick={() =>
              onActionsChange((current) => [
                ...current,
                createAction(
                  current.at(-1)?.actor === 'attacker' ? 'defender' : 'attacker',
                ),
              ])
            }
          >
            + Add action
          </button>
          <button type="button" className="battle-planner-reset" onClick={resetPlan}>
            Reset plan
          </button>
        </div>
      </div>

      <ol className="battle-plan-list">
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
          return (
            <li
              key={action.id}
              className={`battle-plan-row${result?.isKo ? ' is-ko' : ''}${result?.error ? ' has-error' : ''}`}
            >
              <span className="battle-plan-step">{index + 1}</span>
              <PokemonSprite
                className="battle-plan-sprite battle-plan-actor-sprite"
                name={actor.species || actor.name}
                alt={actor.name || actor.species}
              />
              <div className="battle-plan-action">
                <label>
                  <span>Actor</span>
                  <select
                    value={action.actor}
                    onChange={(event) => {
                      const actor = event.target.value as BattlePlanActor;
                      if (action.type === 'move') {
                        updateAction(action.id, { actor, type: 'move', move: action.move });
                      } else {
                        updateAction(action.id, { actor, type: 'switch', targetPokemonId: action.targetPokemonId });
                      }
                    }}
                  >
                    <option value="attacker">Attacker: {getActiveRosterEntry('attacker', index)?.label || attacker.name}</option>
                    <option value="defender">Defender: {getActiveRosterEntry('defender', index)?.label || defender.name}</option>
                  </select>
                </label>
                <label>
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
                  >
                    <option value="move">Move</option>
                    <option value="switch">Switch</option>
                  </select>
                </label>
                {action.type === 'switch' ? (
                  <label className="battle-plan-switch-target">
                    <span>Switch to</span>
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
                    <label className="battle-plan-move">
                      <span>Move</span>
                      <SearchableMovePicker
                        value={action.move.name}
                        options={getActorMoveOptions(action.actor, index)}
                        onSelect={(name) => updateMove(action.id, { name })}
                        ariaLabel={`Plan step ${index + 1} move`}
                      />
                    </label>
                    <label className="battle-plan-check">
                      <input type="checkbox" checked={action.move.isCrit} onChange={(event) => updateMove(action.id, { isCrit: event.target.checked })} />
                      Crit
                    </label>
                    <label className="battle-plan-number">
                      <span>Hits</span>
                      <input type="number" min="1" max="8" value={action.move.hits} onChange={(event) => updateMove(action.id, { hits: Number(event.target.value) || 1 })} />
                    </label>
                    <label className="battle-plan-check">
                      <input type="checkbox" checked={Boolean(action.move.useZ)} disabled={generation < 7} onChange={(event) => updateMove(action.id, { useZ: event.target.checked, useMax: event.target.checked ? false : action.move.useMax })} />
                      Z
                    </label>
                    <label className="battle-plan-check">
                      <input type="checkbox" checked={Boolean(action.move.useMax)} disabled={generation < 8} onChange={(event) => updateMove(action.id, { useMax: event.target.checked, useZ: event.target.checked ? false : action.move.useZ })} />
                      Max
                    </label>
                  </>
                )}
                <div className="battle-plan-row-tools">
                  <div className="battle-plan-order" aria-label={`Reorder plan step ${index + 1}`}>
                    <button
                      type="button"
                      onClick={() => reorderAction(action.id, -1)}
                      disabled={index === 0}
                      aria-label={`Move plan step ${index + 1} up`}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => reorderAction(action.id, 1)}
                      disabled={index === actions.length - 1}
                      aria-label={`Move plan step ${index + 1} down`}
                    >
                      ↓
                    </button>
                  </div>
                  <button
                    type="button"
                    className="battle-plan-remove"
                    onClick={() => onActionsChange((current) => current.filter((item) => item.id !== action.id))}
                    aria-label={`Remove plan step ${index + 1}`}
                  >
                    ×
                  </button>
                </div>
              </div>
              <div className="battle-plan-result">
                <strong>{result?.error ? result.error : action.type === 'switch' ? `Switched to ${result?.activePokemonLabel ?? 'Pokemon'} (0 damage)` : result?.isKo ? 'KO' : `${result?.damage.min ?? 0}-${result?.damage.max ?? 0} damage`}</strong>
                {result && !result.error && (
                  <>
                    <span>
                      {actorName} → {result.isKo ? 'KO' : action.actor === 'attacker'
                        ? `Defender ${formatHpRange(result.defenderHp)} HP`
                        : `Attacker ${formatHpRange(result.attackerHp)} HP`}
                    </span>
                    <PlannerHpRange
                      range={result.targetHp}
                      maxHp={result.targetMaxHp}
                      label={action.type === 'switch' ? result.activePokemonLabel ?? 'Pokemon' : action.actor === 'attacker' ? 'Defender' : 'Attacker'}
                      sprite={action.type === 'switch' ? resultActor : target}
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