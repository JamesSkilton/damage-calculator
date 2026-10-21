// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { syncEncountersToBox } from './activeRun';
import {
  loadImportedPokemonSets,
  loadPartyPokemonSetIds,
  saveImportedPokemonSets,
  savePartyPokemonSetIds,
} from '../import/pokemonSetStorage';
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
});
