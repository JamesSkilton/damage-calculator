import type { ImportedPokemonSet } from './pokemonSet';

export const IMPORTED_POKEMON_SETS_KEY = 'pokemans.imported-pokemon-sets.v1';
export const PARTY_POKEMON_SET_IDS_KEY = 'pokemans.party-pokemon-set-ids.v1';

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

export function loadPartyPokemonSetIds(storage?: Storage): string[] {
  if (!storage && typeof sessionStorage === 'undefined') return [];
  const target = storage ?? sessionStorage;
  try {
    const value = JSON.parse(target.getItem(PARTY_POKEMON_SET_IDS_KEY) || '[]');
    return Array.isArray(value)
      ? value.filter((id): id is string => typeof id === 'string')
      : [];
  } catch {
    return [];
  }
}

export function savePartyPokemonSetIds(
  ids: readonly string[],
  storage?: Storage,
): void {
  if (!storage && typeof sessionStorage === 'undefined') return;
  (storage ?? sessionStorage).setItem(PARTY_POKEMON_SET_IDS_KEY, JSON.stringify(ids));
}

export function removeImportedPokemonSet(
  id: string,
  storage?: Storage,
): ImportedPokemonSet[] {
  const sets = loadImportedPokemonSets(storage).filter((set) => set.id !== id);
  saveImportedPokemonSets(sets, storage);
  savePartyPokemonSetIds(
    loadPartyPokemonSetIds(storage).filter((partyId) => partyId !== id),
    storage,
  );
  return sets;
}