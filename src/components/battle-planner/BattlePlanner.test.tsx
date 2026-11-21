// @vitest-environment jsdom

import { useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { buildBattlePlanResults } from 'adapters/battlePlan';
import type { BattlePlanAction } from 'domain/battlePlan';
import { createBattleFieldDraft } from '../combatant/shared/battleFieldDraft';
import { createTeamDraft } from '../combatant/shared/combatantDraft';
import { createMoveDraft } from '../combatant/moves/moveDraft';
import { createMoveOption } from '../combatant/moves/moveOptions';
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

  it('lets the planner start with a roster Pokémon without loading it into the panel', () => {
    const reserve = {
      ...attacker,
      name: 'Reserve',
      species: 'Bulbasaur',
    };
    const Wrapper = () => {
      const [actions, setActions] = useState<BattlePlanAction[]>([]);
      return (
        <BattlePlanner
          {...base}
          attackerRoster={[
            ...attackerRoster,
            {
              id: 'reserve',
              label: 'Reserve',
              source: 'box',
              combatant: reserve,
              moves: [move],
            },
          ]}
          availableMoves={[]}
          attackerMoves={[move]}
          defenderMoves={[]}
          actions={actions}
          onActionsChange={setActions}
          onBack={() => {}}
        />
      );
    };
    const { unmount } = render(<Wrapper />);

    fireEvent.focus(
      screen.getByRole('textbox', { name: 'Attacker starting Pokémon' }),
    );
    fireEvent.click(
      within(
        screen.getByRole('listbox', {
          name: 'Attacker starting Pokémon options',
        }),
      ).getByRole('option', { name: /Reserve/ }),
    );
    fireEvent.click(screen.getByRole('button', { name: '+ Add action' }));

    expect(
      screen.getByRole('textbox', { name: 'Attacker starting Pokémon' }),
    ).toHaveAttribute('placeholder', 'Reserve');
    expect(
      Array.from(
        screen.getAllByLabelText('Actor')[0].querySelectorAll('option'),
      ).map((option) => option.textContent),
    ).toContain('Attacker: Reserve');
    unmount();
  });

  it('lets you compare starting items for roster Pokémon and recalculates the plan', async () => {
    const naturalGift = createMoveDraft('Natural Gift');
    const onAttackerRosterSelectionChange = vi.fn();
    const reserve = {
      ...attacker,
      name: 'Reserve',
      species: attacker.species,
      item: 'Oran Berry',
      moves: ['Natural Gift'],
    };
    const actions: BattlePlanAction[] = [
      { id: 'gift', actor: 'attacker', type: 'move', move: naturalGift },
    ];
    function Wrapper() {
      const [plan, setPlan] = useState(actions);
      return (
        <BattlePlanner
          {...base}
          attackerRoster={[
            ...attackerRoster,
            {
              id: 'reserve',
              label: 'Reserve',
              source: 'party',
              combatant: reserve,
              moves: [naturalGift],
            },
          ]}
          availableMoves={[createMoveOption('Natural Gift')]}
          attackerMoves={[naturalGift]}
          defenderMoves={[]}
          actions={plan}
          onActionsChange={setPlan}
          onAttackerRosterSelectionChange={onAttackerRosterSelectionChange}
          onBack={() => {}}
        />
      );
    }

    render(<Wrapper />);
    fireEvent.focus(
      screen.getByRole('textbox', { name: 'Attacker starting Pokémon' }),
    );
    fireEvent.click(screen.getByRole('option', { name: /Reserve/ }));
    expect(onAttackerRosterSelectionChange).toHaveBeenCalledWith('reserve');
    const originalPreview = within(
      screen.getByLabelText('Move damage previews'),
    ).getByRole('button', { name: /Natural Gift/ }).textContent;
    fireEvent.click(screen.getByText("Compare my Pokémon's starting item"));
    expect(
      screen.getByRole('textbox', { name: 'Item comparison Pokémon' }),
    ).toHaveAttribute('placeholder', 'Reserve');
    fireEvent.focus(
      screen.getByRole('textbox', { name: 'Item comparison Pokémon' }),
    );
    fireEvent.click(
      within(
        screen.getByRole('listbox', {
          name: 'Item comparison Pokémon options',
        }),
      ).getByRole('option', { name: /Reserve/ }),
    );
    const itemPicker = screen.getByRole('textbox', { name: 'Starting item' });
    fireEvent.focus(itemPicker);
    fireEvent.change(itemPicker, { target: { value: 'Sitrus Berry' } });
    fireEvent.click(
      within(
        screen.getByRole('listbox', { name: 'Starting item options' }),
      ).getByRole('option', { name: 'Sitrus Berry' }),
    );

    await waitFor(() => {
      expect(screen.getByAltText('Sitrus Berry')).toBeInTheDocument();
      expect(
        within(screen.getByLabelText('Move damage previews')).getByRole(
          'button',
          { name: /Natural Gift/ },
        ).textContent,
      ).not.toBe(originalPreview);
    });
  });
});
