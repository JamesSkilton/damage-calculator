import { describe, expect, it } from 'vitest';
import { loadImportedPokemonSets, saveImportedPokemonSets } from './pokemonSetStorage';

describe('pokemon set storage', () => {
  it('round trips imported sets through session storage', () => {
    const storage = new StorageMock();
    const sets = [{ id: 'pikachu-0', species: 'Pikachu' }] as never[];
    saveImportedPokemonSets(sets, storage);
    expect(loadImportedPokemonSets(storage)).toEqual(sets);
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