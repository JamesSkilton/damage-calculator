// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { syncEncountersToBox } from './activeRun';
import {
  loadImportedPokemonSets,
  loadPartyPokemonSetIds,
  saveImportedPokemonSets,
  savePartyPokemonSetIds,
} from '../import/pokemonSetStorage';
import { emptyStats } from '../import/pokemonSet';
import type { RunEncounter } from './types';

const encounter = (
  id: string,
  status: RunEncounter['status'],
  species?: string,
): RunEncounter => ({ id, route: `Route ${id}`, status, species });

describe('syncEncountersToBox', () => {
  beforeEach(() => sessionStorage.clear());

  it('adds caught Pokémon and removes dead ones from box and party', () => {
    syncEncountersToBox([encounter('a', 'caught', 'Pidgey')], 3);
    expect(loadImportedPokemonSets()).toMatchObject([
      { id: 'nuzlocke-a', species: 'Pidgey', generation: 3 },
    ]);

    savePartyPokemonSetIds(['nuzlocke-a']);
    syncEncountersToBox([encounter('a', 'dead', 'Pidgey')], 3);
    expect(loadImportedPokemonSets()).toEqual([]);
    expect(loadPartyPokemonSetIds()).toEqual([]);
  });

  it('keeps edits and unrelated box entries when the species changes', () => {
    syncEncountersToBox([encounter('a', 'caught', 'Pidgey')], 3);
    const [set] = loadImportedPokemonSets();
    saveImportedPokemonSets([
      { ...set, moves: ['Tackle'] },
      { ...set, id: 'other', species: 'Mew' },
    ]);
    syncEncountersToBox([encounter('a', 'caught', 'Rattata')], 3);
    expect(loadImportedPokemonSets()).toMatchObject([
      { id: 'nuzlocke-a', species: 'Rattata', moves: ['Tackle'] },
      { id: 'other', species: 'Mew' },
    ]);
  });

  it('adopts an imported set for a matching caught encounter', () => {
    saveImportedPokemonSets([
      {
        id: 'imported-pidgey',
        generation: 3,
        species: 'Pidgeotto',
        level: 12,
        nature: 'Jolly',
        evs: emptyStats(0),
        ivs: emptyStats(31),
        moves: ['Tackle'],
      },
    ]);
    savePartyPokemonSetIds(['imported-pidgey']);

    syncEncountersToBox([encounter('a', 'caught', 'Pidgey')], 3);

    expect(loadImportedPokemonSets()).toMatchObject([
      {
        id: 'nuzlocke-a',
        species: 'Pidgey',
        level: 12,
        nature: 'Jolly',
        moves: ['Tackle'],
      },
    ]);
    expect(loadImportedPokemonSets()).toHaveLength(1);
    expect(loadPartyPokemonSetIds()).toEqual(['nuzlocke-a']);
  });

  it('adopts an imported regional form for a matching encounter family', () => {
    saveImportedPokemonSets([
      {
        id: 'imported-meowth',
        generation: 8,
        species: 'Meowth-Galar',
        level: 20,
        nature: 'Serious',
        evs: emptyStats(0),
        ivs: emptyStats(31),
        moves: [],
      },
    ]);

    syncEncountersToBox([encounter('galar', 'caught', 'Meowth')], 8);

    expect(loadImportedPokemonSets()).toMatchObject([
      { id: 'nuzlocke-galar', species: 'Meowth' },
    ]);
  });
});
