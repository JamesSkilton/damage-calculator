// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import RunEncounterTable from './RunEncounterTable';
import { parseRoutesText } from '../../nuzlocke/gameText';
import { encountersForGame } from '../../nuzlocke/types';

afterEach(cleanup);
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};

const text = `Route 106 [Surfing]: Sealeo 30%, Starmie 70%
Route 106 [Fishing]: Spheal 50%, Staryu 50%
Granite Cave > 1F [Grass]: Phanpy 100%
Granite Cave > B2F [Grass]: Amaura 100%
Granite Cave > B2F [Rock Smash]: Geodude-Alola 90%, Bergmite 10%`;

function open(routeName: string) {
  const encounters = encountersForGame({ routes: parseRoutesText(text) });
  render(
    <RunEncounterTable
      encounters={encounters}
      speciesOptions={[]}
      disabled={false}
      onChange={vi.fn()}
    />,
  );
  fireEvent.focus(screen.getByRole('textbox', { name: `Pokémon for ${routeName}` }));
  return screen.getByRole('listbox', { name: `Pokémon for ${routeName} options` });
}

describe('run dropdown headings', () => {
  it('shows method headings for a method-only route', () => {
    const list = open('Route 106');
    expect(
      Array.from(list.children).map((li) => li.textContent),
    ).toEqual([
      'Surfing',
      'Starmie (70%)',
      'Sealeo (30%)',
      'Fishing',
      'Spheal (50%)',
      'Staryu (50%)',
    ]);
  });

  it('nests methods under areas for a linked route', () => {
    const list = open('Granite Cave');
    expect(list.querySelectorAll('.type-option-group')).toHaveLength(2);
    expect(list.querySelectorAll('.type-option-subgroup')).toHaveLength(3);
  });
});
