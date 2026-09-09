import type { ImportedPokemonSet } from './pokemonSet';

export const IMPORTED_POKEMON_SETS_KEY = 'pokemans.imported-pokemon-sets.v1';

export function loadImportedPokemonSets(storage?: Storage): ImportedPokemonSet[] {
  if (!storage && typeof sessionStorage === 'undefined') return [];
  const target = storage ?? sessionStorage;
  try {
    const value = JSON.parse(target.getItem(IMPORTED_POKEMON_SETS_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function saveImportedPokemonSets(
  sets: readonly ImportedPokemonSet[],
  storage?: Storage,
): void {
  if (!storage && typeof sessionStorage === 'undefined') return;
  (storage ?? sessionStorage).setItem(IMPORTED_POKEMON_SETS_KEY, JSON.stringify(sets));
}