import { useMemo, useState } from 'react';
import type {
  BattleCombatant,
  BattleField,
  BattlePlanAction,
  BattlePlanActor,
} from 'domain/index';
import { buildBattlePlanResults } from 'adapters/battlePlan';
import type { MoveOption } from '../combatant/moves/moveOptions';
import { createMoveDraft, type MoveDraft } from '../combatant/moves/moveDraft';
import SearchableMovePicker from '../combatant/moves/SearchableMovePicker';
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
};

function createAction(actor: BattlePlanActor): BattlePlanAction {
  return {
    id: `${actor}-${Date.now()}-${Math.random()}`,
    actor,
    move: createMoveDraft(),
  };
}

function formatHpRange(range: { min: number; max: number }): string {
  return range.min === range.max ? `${range.min}` : `${range.min}-${range.max}`;
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
}: BattlePlannerProps) {
  const [actions, setActions] = useState<BattlePlanAction[]>(() => [
    createAction('attacker'),
  ]);
  const results = useMemo(
    () =>
      buildBattlePlanResults({
        generation,
        attacker,
        defender,
        field,
        actions,
      }),
    [actions, attacker, defender, field, generation],
  );

  const updateAction = (
    id: string,
    updates: Partial<Pick<BattlePlanAction, 'actor'>> & {
      move?: Partial<BattlePlanAction['move']>;
    },
  ) => {
    setActions((current) =>
      current.map((action) =>
        action.id === id
          ? {
              ...action,
              ...updates,
              move: { ...action.move, ...updates.move },
            }
          : action,
      ),
    );
  };

  const reorderAction = (id: string, direction: -1 | 1) =>
    setActions((current) => moveAction(current, id, direction));

  const resetPlan = () => setActions([createAction('attacker')]);

  const getActorMoveOptions = (actor: BattlePlanActor): MoveOption[] => {
    const moves = actor === 'attacker' ? attackerMoves : defenderMoves;
    const selectedNames = new Set(
      moves.map((move) => move.name.trim().toLowerCase()).filter(Boolean),
    );

    return availableMoves.filter((move) =>
      selectedNames.has(move.name.toLowerCase()),
    );
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
        <button
          type="button"
          className="battle-planner-add"
          onClick={() =>
            setActions((current) => [
                ...current,
                createAction(current.at(-1)?.actor === 'attacker' ? 'defender' : 'attacker'),
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
          const actor = action.actor === 'attacker' ? attacker : defender;
          const target = action.actor === 'attacker' ? defender : attacker;
          const actorName = action.actor === 'attacker' ? attacker.name : defender.name;
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
                    onChange={(event) =>
                      updateAction(action.id, {
                        actor: event.target.value as BattlePlanActor,
                      })
                    }
                  >
                    <option value="attacker">{attacker.name || 'Attacker'}</option>
                    <option value="defender">{defender.name || 'Defender'}</option>
                  </select>
                </label>
                <label className="battle-plan-move">
                  <span>Move</span>
                  <SearchableMovePicker
                    value={action.move.name}
                    options={getActorMoveOptions(action.actor)}
                    onSelect={(name) => updateAction(action.id, { move: { name } })}
                    ariaLabel={`Plan step ${index + 1} move`}
                  />
                </label>
                <label className="battle-plan-check">
                  <input
                    type="checkbox"
                    checked={action.move.isCrit}
                    onChange={(event) =>
                      updateAction(action.id, {
                        move: { isCrit: event.target.checked },
                      })
                    }
                  />
                  Crit
                </label>
                <label className="battle-plan-number">
                  <span>Hits</span>
                  <input
                    type="number"
                    min="1"
                    max="8"
                    value={action.move.hits}
                    onChange={(event) =>
                      updateAction(action.id, {
                        move: { hits: Number(event.target.value) || 1 },
                      })
                    }
                  />
                </label>
                <label className="battle-plan-check">
                  <input
                    type="checkbox"
                    checked={Boolean(action.move.useZ)}
                    disabled={generation < 7}
                    onChange={(event) =>
                      updateAction(action.id, {
                        move: {
                          useZ: event.target.checked,
                          useMax: event.target.checked ? false : action.move.useMax,
                        },
                      })
                    }
                  />
                  Z
                </label>
                <label className="battle-plan-check">
                  <input
                    type="checkbox"
                    checked={Boolean(action.move.useMax)}
                    disabled={generation < 8}
                    onChange={(event) =>
                      updateAction(action.id, {
                        move: {
                          useMax: event.target.checked,
                          useZ: event.target.checked ? false : action.move.useZ,
                        },
                      })
                    }
                  />
                  Max
                </label>
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
                    onClick={() => setActions((current) => current.filter((item) => item.id !== action.id))}
                    aria-label={`Remove plan step ${index + 1}`}
                  >
                    ×
                  </button>
                </div>
              </div>
              <div className="battle-plan-result">
                <strong>{result?.error ? 'Waiting for a move' : result?.isKo ? 'KO' : `${result?.damage.min ?? 0}-${result?.damage.max ?? 0} damage`}</strong>
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
                      label={action.actor === 'attacker' ? 'Defender' : 'Attacker'}
                      sprite={target}
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