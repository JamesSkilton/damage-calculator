// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import App from 'App';
import { emptyStats } from '../../import/pokemonSet';
import {
  saveImportedPokemonSets,
  savePartyPokemonSetIds,
  loadImportedPokemonSets,
} from '../../import/pokemonSetStorage';

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  localStorage.clear();
});

describe('one-vs-one battle planner', () => {
  it('opens matchup settings from the box and preserves changes', () => {
    const app = () => (
      <MemoryRouter initialEntries={['/one-vs-one']}>
        <App />
      </MemoryRouter>
    );
    const { unmount } = render(app());
    fireEvent.click(screen.getByText('Manage party and imported Pokemon'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Matchup settings' }));
    const dialog = screen.getByRole('dialog', { name: 'Matchups vs Defender' });
    expect(
      within(dialog).getByText(/A green border means it outspeeds/),
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Good if survives hits')).toHaveValue(
      4,
    );
    expect(
      within(dialog).getByLabelText('Excellent: survives hits'),
    ).toHaveValue(2);
    fireEvent.change(within(dialog).getByLabelText('Excellent: KOs in hits'), {
      target: { value: '1' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    unmount();
    render(app());
    fireEvent.click(screen.getByText('Manage party and imported Pokemon'));
    fireEvent.click(screen.getByRole('button', { name: 'Matchup settings' }));
    expect(screen.getByLabelText('Excellent: KOs in hits')).toHaveValue(1);
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

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

  it('edits a switched-in attacker from the attacker panel', () => {
    saveImportedPokemonSets([
      {
        id: 'pikachu',
        generation: 9,
        species: 'Pikachu',
        item: 'Oran Berry',
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

    render(
      <MemoryRouter initialEntries={['/one-vs-one']}>
        <App />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Plan battle' }));
    fireEvent.click(screen.getByRole('button', { name: '+ Add action' }));
    fireEvent.change(screen.getAllByLabelText('Actor')[0], {
      target: { value: 'attacker' },
    });
    fireEvent.change(screen.getAllByLabelText('Action')[0], {
      target: { value: 'switch' },
    });
    fireEvent.click(
      screen
        .getAllByRole('button', { name: 'Load Eevee into attacker' })
        .at(-1)!,
    );
    fireEvent.click(screen.getByRole('button', { name: '+ Add action' }));
    fireEvent.change(screen.getAllByLabelText('Actor')[1], {
      target: { value: 'attacker' },
    });

    const panel = screen.getByRole('article', { name: /Attacker panel/ });
    expect(within(panel).getByRole('heading', { name: 'Eevee' })).toBeVisible();
    const item = within(panel).getByRole('textbox', { name: 'Item' });
    fireEvent.focus(item);
    fireEvent.change(item, { target: { value: 'Sitrus Berry' } });
    fireEvent.click(
      within(panel).getByRole('option', { name: 'Sitrus Berry' }),
    );

    expect(
      within(
        screen.getByRole('region', { name: 'Battle planner' }),
      ).getAllByAltText('Sitrus Berry'),
    ).not.toHaveLength(0);
  });

  it('saves an edited box item across sessions without changing the planned Pokémon', () => {
    saveImportedPokemonSets([
      {
        id: 'pikachu',
        generation: 9,
        species: 'Pikachu',
        item: 'Oran Berry',
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
    const app = () => (
      <MemoryRouter initialEntries={['/one-vs-one']}>
        <App />
      </MemoryRouter>
    );
    const { unmount } = render(app());
    fireEvent.click(screen.getByRole('button', { name: 'Plan battle' }));
    fireEvent.focus(
      screen.getByRole('textbox', { name: 'Attacker starting Pokémon' }),
    );
    fireEvent.click(screen.getByRole('option', { name: /Eevee/ }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Load Pikachu into attacker' }),
    );

    const panel = screen.getByRole('article', { name: /Attacker panel/ });
    const item = within(panel).getByRole('textbox', { name: 'Item' });
    fireEvent.focus(item);
    fireEvent.change(item, { target: { value: 'Sitrus Berry' } });
    fireEvent.click(
      within(panel).getByRole('option', { name: 'Sitrus Berry' }),
    );

    expect(loadImportedPokemonSets()).toMatchObject([
      { id: 'pikachu', item: 'Sitrus Berry' },
      { id: 'eevee' },
    ]);
    expect(
      screen.getByRole('textbox', { name: 'Attacker starting Pokémon' }),
    ).toHaveAttribute('placeholder', 'Pikachu');
    expect(
      within(panel).getByText(/Item changes are saved automatically/),
    ).toBeInTheDocument();

    fireEvent.click(within(panel).getByRole('button', { name: 'Clear Item' }));
    expect(loadImportedPokemonSets()[0].item).toBeUndefined();
    fireEvent.focus(item);
    fireEvent.change(item, { target: { value: 'Sitrus Berry' } });
    fireEvent.click(
      within(panel).getByRole('option', { name: 'Sitrus Berry' }),
    );

    unmount();
    sessionStorage.clear();
    render(app());
    expect(loadImportedPokemonSets()[0].item).toBe('Sitrus Berry');
    expect(screen.getByText('Sitrus Berry')).toBeInTheDocument();
  });
});
