// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import App from 'App';
import { emptyStats } from '../../import/pokemonSet';
import {
  saveImportedPokemonSets,
  savePartyPokemonSetIds,
} from '../../import/pokemonSetStorage';

afterEach(() => {
  cleanup();
  sessionStorage.clear();
});

describe('one-vs-one battle planner', () => {
  it('keeps the plan open when selecting a Pokemon from the box', () => {
    saveImportedPokemonSets([
      {
        id: 'pikachu',
        generation: 9,
        species: 'Pikachu',
        level: 50,
        nature: 'Serious',
        evs: emptyStats(0),
        ivs: emptyStats(31),
        moves: ['Thunderbolt'],
      },
      {
        id: 'eevee',
        generation: 9,
        species: 'Eevee',
        level: 50,
        nature: 'Serious',
        evs: emptyStats(0),
        ivs: emptyStats(31),
        moves: ['Tackle'],
      },
    ]);
    savePartyPokemonSetIds(['pikachu', 'eevee']);

    const { container } = render(
      <MemoryRouter initialEntries={['/one-vs-one']}>
        <App />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Plan battle' }));
    fireEvent.click(screen.getByRole('button', { name: '+ Add action' }));
    fireEvent.change(screen.getAllByLabelText('Actor')[0], {
      target: { value: 'attacker' },
    });

    expect(
      screen.getByText('Manage party and imported Pokemon').closest('details'),
    ).toHaveAttribute('open');

    const eeveeButtons = screen.getAllByRole('button', {
      name: 'Load Eevee into attacker',
    });
    fireEvent.click(eeveeButtons.at(-1)!);

    expect(
      screen.getByRole('region', { name: 'Battle planner' }),
    ).toBeInTheDocument();
    expect(
      container.querySelector('.battle-plan-step .battle-plan-sprite'),
    ).toHaveAttribute('alt', 'Eevee');
    expect(screen.getAllByLabelText('Actor')[0]).toHaveDisplayValue(
      'Attacker: Eevee',
    );
    expect(screen.getAllByRole('button', { name: /Remove turn/ })).toHaveLength(
      1,
    );
  });
});
