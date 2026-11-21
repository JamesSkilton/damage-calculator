// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBattleFieldDraft } from '../combatant/shared/battleFieldDraft';
import { createTeamDraft } from '../combatant/shared/combatantDraft';
import { createMoveDraft } from '../combatant/moves/moveDraft';
import { createMoveOption } from '../combatant/moves/moveOptions';
import type { BattlePlanAction } from 'domain/index';
import BattlePlanner from './BattlePlanner';

vi.mock('../../nuzlocke/useActiveAiProfile', () => ({
  useActiveAiProfile: () => 'run-and-bun',
}));

afterEach(cleanup);

describe('battle planner AI graph', () => {
  const renderChangingMatchup = (aiSuggested: boolean) => {
    const team = createTeamDraft(9);
    const regular = { ...team.attacker, ability: 'No Guard' };
    const innerFocus = {
      ...team.attacker,
      name: 'Inner Focus',
      ability: 'Inner Focus',
    };
    const fakeOut = createMoveDraft('Fake Out');
    const bodySlam = createMoveDraft('Body Slam');
    const tackle = createMoveDraft('Tackle');
    const actions: BattlePlanAction[] = [
      {
        id: 'ai',
        actor: 'defender',
        type: 'move',
        move: { ...fakeOut, aiSuggested },
      },
    ];

    function Harness() {
      const [attackerRosterId, setAttackerRosterId] = useState('regular');
      const [plan, setPlan] = useState(actions);
      return (
        <>
          <button onClick={() => setAttackerRosterId('inner-focus')}>
            Use Inner Focus
          </button>
          <BattlePlanner
            generation={9}
            attacker={regular}
            defender={team.defender}
            field={createBattleFieldDraft(9)}
            attackerRoster={[
              {
                id: 'regular',
                label: 'Regular',
                source: 'current',
                combatant: regular,
                moves: [tackle],
              },
              {
                id: 'inner-focus',
                label: 'Inner Focus',
                source: 'party',
                combatant: innerFocus,
                moves: [tackle],
              },
            ]}
            defenderRoster={[
              {
                id: 'defender',
                label: 'Defender',
                source: 'current',
                combatant: team.defender,
                moves: [fakeOut, bodySlam],
              },
            ]}
            attackerRosterId={attackerRosterId}
            defenderRosterId="defender"
            availableMoves={[]}
            attackerMoves={[tackle]}
            defenderMoves={[fakeOut, bodySlam]}
            actions={plan}
            onActionsChange={setPlan}
            onBack={() => {}}
          />
        </>
      );
    }

    return render(<Harness />);
  };

  it('renders graph move predictions for an opponent move', () => {
    const team = createTeamDraft(9);
    const tackle = createMoveDraft('Tackle');
    const html = renderToStaticMarkup(
      <BattlePlanner
        generation={9}
        attacker={team.attacker}
        defender={team.defender}
        field={createBattleFieldDraft(9)}
        attackerRoster={[
          {
            id: 'attacker',
            label: 'Attacker',
            source: 'current',
            combatant: team.attacker,
            moves: [tackle],
          },
        ]}
        defenderRoster={[
          {
            id: 'defender',
            label: 'Defender',
            source: 'current',
            combatant: team.defender,
            moves: [tackle],
          },
        ]}
        attackerRosterId="attacker"
        defenderRosterId="defender"
        availableMoves={[]}
        attackerMoves={[tackle]}
        defenderMoves={[tackle]}
        actions={[{ id: 'ai', actor: 'defender', type: 'move', move: tackle }]}
        onActionsChange={() => {}}
        onBack={() => {}}
      />,
    );
    expect(html).toContain('Run &amp; Bun AI suggests Tackle');
    expect(html).toContain('Move probabilities and decision graph');
    expect(html).toContain('Graph 100.0%');
    expect(html).toContain('View Tackle AI details');
  });

  it('passes Berry history to the graph for the current step', () => {
    const team = createTeamDraft(9);
    const tackle = createMoveDraft('Tackle');
    const belch = createMoveDraft('Belch');
    const fakeOut = createMoveDraft('Fake Out');
    const defender = { ...team.defender, item: 'Kee Berry' };
    const renderPlan = (hitFirst: boolean) =>
      render(
        <BattlePlanner
          generation={9}
          attacker={team.attacker}
          defender={defender}
          field={createBattleFieldDraft(9)}
          attackerRoster={[
            {
              id: 'attacker',
              label: 'Attacker',
              source: 'current',
              combatant: team.attacker,
              moves: [tackle],
            },
          ]}
          defenderRoster={[
            {
              id: 'defender',
              label: 'Defender',
              source: 'current',
              combatant: defender,
              moves: [belch, tackle, fakeOut],
            },
          ]}
          attackerRosterId="attacker"
          defenderRosterId="defender"
          availableMoves={[]}
          attackerMoves={[tackle]}
          defenderMoves={[belch, tackle, fakeOut]}
          actions={[
            ...(hitFirst
              ? [
                  {
                    id: 'hit',
                    actor: 'attacker' as const,
                    type: 'move' as const,
                    move: tackle,
                  },
                ]
              : []),
            { id: 'ai', actor: 'defender', type: 'move', move: belch },
          ]}
          onActionsChange={() => {}}
          onBack={() => {}}
        />,
      );
    const before = renderPlan(false);
    fireEvent.click(screen.getByText('Move probabilities and decision graph'));
    fireEvent.click(
      screen.getByRole('button', { name: 'View Belch AI details' }),
    );
    expect(
      within(screen.getByRole('dialog')).getByText(
        /Belch fails without an eaten Berry: never/,
      ),
    ).toBeInTheDocument();
    before.unmount();
    renderPlan(true);
    fireEvent.click(screen.getByText('Move probabilities and decision graph'));
    fireEvent.click(
      screen.getByRole('button', { name: 'View Belch AI details' }),
    );
    expect(
      within(screen.getByRole('dialog')).queryByText(
        /Belch fails without an eaten Berry: never/,
      ),
    ).not.toBeInTheDocument();
  });

  it('updates AI-preselected moves when the player Pokémon changes', async () => {
    renderChangingMatchup(true);
    const suggestion = screen.getByText(/Run & Bun AI suggests Fake Out/);
    expect(suggestion).toHaveTextContent('Run & Bun AI suggests Fake Out');

    fireEvent.click(screen.getByRole('button', { name: 'Use Inner Focus' }));

    await waitFor(() => {
      expect(
        screen.getByText(/Run & Bun AI suggests Body Slam/),
      ).toHaveTextContent('Pre-selected.');
    });
  });

  it('does not replace a move the user selected manually', async () => {
    renderChangingMatchup(false);
    fireEvent.click(screen.getByRole('button', { name: 'Use Inner Focus' }));

    await waitFor(() => {
      expect(
        screen.getByText(/Run & Bun AI suggests Body Slam/),
      ).toHaveTextContent('Fake Out has');
    });
    expect(
      screen.getByText(/Run & Bun AI suggests Body Slam/),
    ).not.toHaveTextContent('Pre-selected.');
  });

  it('shows no move after Fake Out and restores the preselected move when removed', () => {
    const team = createTeamDraft(9);
    const fakeOut = createMoveDraft('Fake Out');
    const tackle = createMoveDraft('Tackle');
    const bodySlam = createMoveDraft('Body Slam');
    const attacker = { ...team.attacker, currentHp: 100, ability: 'No Guard' };
    const defender = { ...team.defender, currentHp: 100, ability: 'Static' };

    function Harness() {
      const [actions, setActions] = useState<BattlePlanAction[]>([
        { id: 'player', actor: 'attacker', type: 'move', move: tackle },
        {
          id: 'ai',
          actor: 'defender',
          type: 'move',
          move: { ...bodySlam, aiSuggested: true },
        },
        { id: 'end', actor: 'attacker', type: 'end-turn' },
      ]);
      return (
        <BattlePlanner
          generation={9}
          attacker={attacker}
          defender={defender}
          field={createBattleFieldDraft(9)}
          attackerRoster={[
            {
              id: 'attacker',
              label: 'Attacker',
              source: 'current',
              combatant: attacker,
              moves: [tackle, fakeOut],
            },
          ]}
          defenderRoster={[
            {
              id: 'defender',
              label: 'Defender',
              source: 'current',
              combatant: defender,
              moves: [bodySlam],
            },
          ]}
          attackerRosterId="attacker"
          defenderRosterId="defender"
          availableMoves={[
            createMoveOption('Tackle', 'Normal', 40, 'Physical'),
            createMoveOption('Fake Out', 'Normal', 40, 'Physical'),
            createMoveOption('Body Slam', 'Normal', 85, 'Physical'),
          ]}
          attackerMoves={[tackle, fakeOut]}
          defenderMoves={[bodySlam]}
          actions={actions}
          onActionsChange={setActions}
          onBack={() => {}}
        />
      );
    }

    render(<Harness />);
    const defenderRow = () =>
      screen
        .getByRole('button', { name: /^Body Slam/ })
        .closest('.battle-plan-step') as HTMLElement;
    expect(within(defenderRow()).getByLabelText('Action')).toHaveValue('move');
    expect(
      within(defenderRow()).getByRole('button', { name: /^Body Slam/ }),
    ).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: /Fake Out/ }));

    expect(within(defenderRow()).getByLabelText('Action')).toHaveValue('skip');
    expect(
      within(defenderRow()).getByText('No move (flinched)'),
    ).toBeInTheDocument();
    expect(
      within(defenderRow()).getByRole('button', { name: /^Body Slam/ }),
    ).toHaveAttribute('aria-pressed', 'false');
    expect(
      within(defenderRow()).getByRole('button', { name: /^Body Slam/ }),
    ).toBeDisabled();
    expect(
      within(defenderRow()).getByText(/Run & Bun AI suggests/),
    ).not.toHaveTextContent('Pre-selected.');

    fireEvent.click(screen.getByRole('button', { name: /Tackle/ }));

    expect(within(defenderRow()).getByLabelText('Action')).toHaveValue('move');
    expect(
      within(defenderRow()).getByRole('button', { name: /^Body Slam/ }),
    ).toHaveAttribute('aria-pressed', 'true');
  });
});
