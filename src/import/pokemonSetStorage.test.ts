// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import {
  ACTIVE_RUN_KEY,
  loadImportedPokemonSets,
  loadPartyPokemonSetIds,
  mergeImportedPokemonSets,
  removeImportedPokemonSet,
  saveImportedPokemonSets,
  savePartyPokemonSetIds,
} from './pokemonSetStorage';

describe('pokemon set storage', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('round trips imported sets through session storage', () => {
    const storage = new StorageMock();
    const sets = [{ id: 'pikachu-0', species: 'Pikachu' }] as never[];
    saveImportedPokemonSets(sets, storage);
    expect(loadImportedPokemonSets(storage)).toEqual(sets);
  });

  it('persists party ids and removes deleted sets from both collections', () => {
    const storage = new StorageMock();
    const sets = [{ id: 'pikachu-0' }, { id: 'bulbasaur-0' }] as never[];
    saveImportedPokemonSets(sets, storage);
    savePartyPokemonSetIds(['pikachu-0', 'bulbasaur-0'], storage);

    removeImportedPokemonSet('pikachu-0', storage);

    expect(loadImportedPokemonSets(storage)).toEqual([{ id: 'bulbasaur-0' }]);
    expect(loadPartyPokemonSetIds(storage)).toEqual(['bulbasaur-0']);
  });

  it('restores a scratch box and party after the tab session ends', () => {
    const sets = [{ id: 'pikachu', species: 'Pikachu', item: 'Oran Berry' }] as never[];
    saveImportedPokemonSets(sets);
    savePartyPokemonSetIds(['pikachu']);
    sessionStorage.clear();

    expect(loadImportedPokemonSets()).toEqual(sets);
    expect(loadPartyPokemonSetIds()).toEqual(['pikachu']);
  });

  it('keeps the active run box separate from the durable scratch box', () => {
    const scratch = [{ id: 'scratch', species: 'Pikachu' }] as never[];
    saveImportedPokemonSets(scratch);
    savePartyPokemonSetIds(['scratch']);
    localStorage.setItem(ACTIVE_RUN_KEY, JSON.stringify({ libraryId: 'lib', runId: 'run' }));
    sessionStorage.clear();
    expect(loadImportedPokemonSets()).toEqual([]);
    expect(loadPartyPokemonSetIds()).toEqual([]);

    saveImportedPokemonSets([{ id: 'run', species: 'Eevee' }] as never[]);
    savePartyPokemonSetIds(['run']);
    expect(loadImportedPokemonSets(localStorage)).toEqual(scratch);
    expect(loadPartyPokemonSetIds(localStorage)).toEqual(['scratch']);
  });

  it('updates an existing imported set while preserving its id', () => {
    const existing = [
      { id: 'pidgey-0', species: 'Pidgey', nickname: 'Sparky', level: 10 },
    ] as never[];
    const incoming = [
      {
        id: 'pidgeotto-1',
        species: 'Pidgeotto',
        nickname: 'Sparky',
        level: 25,
      },
      { id: 'eevee-0', species: 'Eevee', level: 12 },
    ] as never[];

    expect(mergeImportedPokemonSets(existing, incoming)).toEqual([
      {
        id: 'pidgey-0',
        species: 'Pidgeotto',
        nickname: 'Sparky',
        level: 25,
      },
      { id: 'eevee-0', species: 'Eevee', level: 12 },
    ]);
  });
});

class StorageMock implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}
