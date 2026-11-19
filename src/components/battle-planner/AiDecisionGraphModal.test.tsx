// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { predictRunAndBunGraph } from 'ai/runAndBunGraph';
import AiDecisionGraph from './AiDecisionGraph';

afterEach(cleanup);

describe('AI decision graph details', () => {
  it('opens the chosen move, switches moves and closes with Escape', () => {
    const graph = predictRunAndBunGraph({
      aiHp: 100,
      aiMaxHp: 100,
      aiSpeed: 100,
      playerHp: 100,
      playerMaxHp: 100,
      playerSpeed: 50,
      playerMoveCategories: ['Physical'],
      playerMaxDamage: 10,
      firstTurnOut: false,
      moves: [
        {
          name: 'Tackle',
          category: 'Physical',
          priority: 0,
          damageRolls: [30],
        },
        { name: 'Protect', category: 'Status', priority: 0, damageRolls: [] },
      ],
    });
    render(<AiDecisionGraph graph={graph} />);
    fireEvent.click(screen.getByText('Move probabilities and decision graph'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'View Tackle AI details' }),
    );
    const dialog = screen.getByRole('dialog', {
      name: 'AI decision breakdown',
    });
    expect(
      within(dialog).getByRole('img', { name: /Decision graph for Tackle/ }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText('Score distribution and rules'),
    ).toBeInTheDocument();
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Highest damaging move?' }),
    );
    expect(within(dialog).getByRole('status')).toHaveTextContent(
      'Reached in 100.0%',
    );
    fireEvent.click(within(dialog).getByRole('button', { name: 'Protect' }));
    expect(
      within(dialog).getByRole('img', { name: /Decision graph for Protect/ }),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('status')).toHaveTextContent(
      'Select a node',
    );
    fireEvent.keyDown(dialog, { key: 'Escape', code: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
