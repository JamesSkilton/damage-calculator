import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildBattlePlanResults } from 'adapters/battlePlan';
import type { BattlePlanAction } from 'domain/battlePlan';
import { createBattleFieldDraft } from '../combatant/shared/battleFieldDraft';
import { createTeamDraft } from '../combatant/shared/combatantDraft';
import { createMoveDraft } from '../combatant/moves/moveDraft';
import BattlePlanner from './BattlePlanner';

describe('battle planner turn summary', () => {
  const team = createTeamDraft(9);
  const attacker = {
    ...team.attacker,
    level: 10,
    item: undefined,
    moves: ['Tackle'],
  };
  const defender = {
    ...team.defender,
    level: 10,
    currentHp: 18,
    ivs: { ...team.defender.ivs, hp: 21 },
    item: 'Oran Berry',
  };
  const field = createBattleFieldDraft(9);
  const move = createMoveDraft('Tackle');
  const attackerRoster = [
    {
      id: 'attacker',
      label: 'Attacker',
      source: 'current',
      combatant: attacker,
      moves: [move],
    },
  ];
  const defenderRoster = [
    {
      id: 'defender',
      label: 'Defender',
      source: 'current',
      combatant: defender,
      moves: [],
    },
  ];
  const base = {
    generation: 9 as const,
    attacker,
    defender,
    field,
    attackerRoster,
    defenderRoster,
    attackerRosterId: 'attacker',
    defenderRosterId: 'defender',
  };
  const hit: BattlePlanAction = {
    id: 'hit',
    actor: 'attacker',
    type: 'move',
    move,
  };
  const end: BattlePlanAction = {
    id: 'end',
    actor: 'attacker',
    type: 'end-turn',
  };
  const renderPlan = (actions: BattlePlanAction[]) =>
    renderToStaticMarkup(
      <BattlePlanner
        {...base}
        availableMoves={[]}
        attackerMoves={[move]}
        defenderMoves={[]}
        actions={actions}
        onActionsChange={() => {}}
        onBack={() => {}}
      />,
    );

  it('shows a hit-triggered berry as a distinct healing segment in the turn summary', () => {
    const actions = [hit, end];
    const [result] = buildBattlePlanResults({ ...base, actions });
    const markup = renderPlan(actions);

    expect(result.maxHp.defender).toBe(31);
    expect(result.damage.min).toBeGreaterThan(0);
    expect(result.healing[0].amount).toEqual({ min: 10, max: 10 });
    expect(markup).toContain(
      'hp-range-bar-gain-heal" style="width:32.25806451612903%"',
    );
    expect(markup).toContain('Oran Berry healed 10 HP');
  });

  it('does not attribute old healing to a later HP correction', () => {
    const actions: BattlePlanAction[] = [
      hit,
      { id: 'correct', actor: 'defender', type: 'state', hp: 7 },
      end,
    ];
    const markup = renderPlan(actions);

    expect(markup).not.toContain('hp-range-bar-gain-heal"');
    expect(markup).toContain('Oran Berry restored 10 HP');
  });

  it('orders HP sections to match the action cards', () => {
    const defenderMove: BattlePlanAction = {
      id: 'defender-hit',
      actor: 'defender',
      type: 'move',
      move,
    };
    const hpOrder = (actions: BattlePlanAction[]) =>
      renderPlan(actions).match(/(?:Attacker|Defender) remaining/g);

    expect(hpOrder([hit, defenderMove, end])).toEqual([
      'Attacker remaining',
      'Defender remaining',
    ]);
    expect(hpOrder([defenderMove, hit, end])).toEqual([
      'Defender remaining',
      'Attacker remaining',
    ]);
  });

  it('orders each turn independently and ignores state adjustments', () => {
    const defenderMove: BattlePlanAction = {
      id: 'defender-hit',
      actor: 'defender',
      type: 'move',
      move,
    };
    const markup = renderPlan([
      { id: 'state', actor: 'attacker', type: 'state', status: 'par' },
      defenderMove,
      hit,
      end,
      { ...hit, id: 'second-hit' },
      { ...defenderMove, id: 'second-defender-hit' },
      { ...end, id: 'second-end' },
    ]);

    expect(markup.match(/(?:Attacker|Defender) remaining/g)).toEqual([
      'Defender remaining',
      'Attacker remaining',
      'Attacker remaining',
      'Defender remaining',
    ]);
  });

  it('puts a switching side first when its switch is the first action', () => {
    const markup = renderPlan([
      {
        id: 'switch',
        actor: 'defender',
        type: 'switch',
        targetPokemonId: 'defender',
      },
      hit,
      end,
    ]);

    expect(markup.match(/(?:Attacker|Defender) remaining/g)).toEqual([
      'Defender remaining',
      'Attacker remaining',
    ]);
  });
});
