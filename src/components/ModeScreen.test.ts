import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import ModeScreen from 'components/ModeScreen';
import type { CalculatorMode } from 'modes/calculatorModes';

const mockedUseOutletContext = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', () => ({
  useOutletContext: mockedUseOutletContext,
}));

describe('ModeScreen', () => {
  const mode: CalculatorMode = {
    slug: 'one-vs-all',
    label: 'One vs All',
    title: 'One vs All',
    description:
      'A spread view for comparing one attacker against many targets.',
    placeholderTodo:
      'TODO: migrate the one-vs-all target list and results flow into this route.',
  };

  it('renders the one-vs-all placeholder route copy', () => {
    mockedUseOutletContext.mockReturnValue('/one-vs-all');

    const markup = renderToStaticMarkup(React.createElement(ModeScreen, { mode }));

    expect(markup).toContain('Placeholder route');
    expect(markup).toContain('<h2>One vs All</h2>');
    expect(markup).toContain(mode.description);
    expect(markup).toContain('One vs All migration boundary');
    expect(markup).toContain('TODO boundary');
    expect(markup).toContain(mode.placeholderTodo);
    expect(markup).toContain('Shared shell is live at /one-vs-all');
  });
});
