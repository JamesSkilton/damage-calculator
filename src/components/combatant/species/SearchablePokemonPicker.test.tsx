// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import SearchablePokemonPicker from './SearchablePokemonPicker';

afterEach(cleanup);

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

describe('SearchablePokemonPicker', () => {
  it('groups presets by Pokemon and matches build names', () => {
    render(
      <SearchablePokemonPicker
        value=""
        options={[
          {
            name: '@preset:ivysaur-defensive',
            displayName: 'NFE Defensive',
            types: ['Grass', 'Poison'],
            group: 'Ivysaur',
            presetId: 'ivysaur-defensive',
          },
          {
            name: 'Ivysaur',
            types: ['Grass', 'Poison'],
            group: 'Ivysaur',
          },
        ]}
        onSelect={vi.fn()}
        ariaLabel="Pokémon"
      />,
    );

    const input = screen.getByRole('textbox', { name: 'Pokémon' });
    fireEvent.focus(input);
    expect(screen.getAllByText('Ivysaur')).toHaveLength(2);
    expect(screen.getByText('NFE Defensive')).toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'defensive' } });
    expect(screen.getByText('NFE Defensive')).toBeInTheDocument();
    expect(screen.getAllByText('Ivysaur')).toHaveLength(1);
  });

  it('does not use page-level scrolling when highlighting an option', () => {
    const scrollIntoView = vi.fn();
    const originalScrollIntoView = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scrollIntoView;

    try {
      render(
        <SearchablePokemonPicker
          value=""
          options={[
            {
              name: '@preset:ivysaur-defensive',
              displayName: 'NFE Defensive',
              types: ['Grass', 'Poison'],
              group: 'Ivysaur',
              presetId: 'ivysaur-defensive',
            },
          ]}
          onSelect={vi.fn()}
          ariaLabel="Pokémon"
        />,
      );

      fireEvent.focus(screen.getByRole('textbox', { name: 'Pokémon' }));
      fireEvent.mouseEnter(screen.getByText('NFE Defensive'));

      expect(scrollIntoView).not.toHaveBeenCalled();
    } finally {
      Element.prototype.scrollIntoView = originalScrollIntoView;
    }
  });
});