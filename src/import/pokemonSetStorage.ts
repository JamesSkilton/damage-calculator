import type { ImportedPokemonSet } from './pokemonSet';
import { familyOf } from '../nuzlocke/dupesClause';

export const IMPORTED_POKEMON_SETS_KEY = 'pokemans.imported-pokemon-sets.v1';
export const PARTY_POKEMON_SET_IDS_KEY = 'pokemans.party-pokemon-set-ids.v1';
export const BOX_CHANGED_EVENT = 'pokemans.box-changed';

function notifyBoxChanged(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(BOX_CHANGED_EVENT));
}

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
  notifyBoxChanged();
}

function importIdentity(set: Pick<ImportedPokemonSet, 'species' | 'nickname'>): string {
  return `${familyOf(set.species)}\u0000${set.nickname ?? ''}`;
}

export function mergeImportedPokemonSets(
  existing: readonly ImportedPokemonSet[],
  incoming: readonly ImportedPokemonSet[],
): ImportedPokemonSet[] {
  const next = [...existing];
  for (const set of incoming) {
    const index = next.findIndex(
      (candidate) => importIdentity(candidate) === importIdentity(set),
    );
    if (index < 0) {
      next.push(set);
      continue;
    }
    next[index] = { ...set, id: next[index].id };
  }
  return next;
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
  notifyBoxChanged();
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
