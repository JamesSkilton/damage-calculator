import type { NuzlockeClient } from './httpClient';
import type { NuzlockeRun, RunBoxSet, RunEncounter } from './types';
import { loadPresetLibraryCache } from '../presets/remote/presetLibraryCache';
import {
  BOX_CHANGED_EVENT,
  IMPORTED_POKEMON_SETS_KEY,
  PARTY_POKEMON_SET_IDS_KEY,
  saveImportedPokemonSets,
  savePartyPokemonSetIds,
} from '../import/pokemonSetStorage';
import { emptyStats, type ImportedPokemonSet } from '../import/pokemonSet';
import { familyOf } from './dupesClause';

export { BOX_CHANGED_EVENT };
export const ACTIVE_RUN_CHANGED_EVENT = 'pokemans.active-run-changed';
export const ACTIVE_RUN_KEY = 'pokemans.active-nuzlocke-run.v1';
const SCRATCH_BOX_KEY = 'pokemans.scratch-box.v1';
const SYNC_DELAY_MS = 800;

interface ActiveRun {
  libraryId: string;
  runId: string;
}

export interface ActiveTarget {
  runId: string;
  ownerCode: string;
}

function readJson<T>(storage: Storage, key: string, fallback: T): T {
  try {
    const value = JSON.parse(storage.getItem(key) || 'null');
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

export function loadActiveRun(): ActiveRun | undefined {
  if (typeof localStorage === 'undefined') return undefined;
  const value = readJson<Partial<ActiveRun> | null>(
    localStorage,
    ACTIVE_RUN_KEY,
    null,
  );
  return typeof value?.libraryId === 'string' && typeof value.runId === 'string'
    ? { libraryId: value.libraryId, runId: value.runId }
    : undefined;
}

// The active run only counts while its library is the one currently selected and editable.
export function getActiveTarget(): ActiveTarget | undefined {
  const active = loadActiveRun();
  const library = loadPresetLibraryCache();
  if (
    !active ||
    !library?.ownerCode ||
    library.snapshot.library.id !== active.libraryId
  )
    return undefined;
  return { runId: active.runId, ownerCode: library.ownerCode };
}

function writeBox(
  box: readonly RunBoxSet[],
  partyIds: readonly string[],
): void {
  sessionStorage.setItem(IMPORTED_POKEMON_SETS_KEY, JSON.stringify(box));
  sessionStorage.setItem(PARTY_POKEMON_SET_IDS_KEY, JSON.stringify(partyIds));
}

function readBox(): { box: RunBoxSet[]; partyIds: string[] } {
  const box = readJson<unknown>(sessionStorage, IMPORTED_POKEMON_SETS_KEY, []);
  const partyIds = readJson<unknown>(
    sessionStorage,
    PARTY_POKEMON_SET_IDS_KEY,
    [],
  );
  return {
    box: Array.isArray(box) ? (box as RunBoxSet[]) : [],
    partyIds: Array.isArray(partyIds)
      ? partyIds.filter((id): id is string => typeof id === 'string')
      : [],
  };
}

let client: NuzlockeClient | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;
let dirty = false;

export async function flushBoxSync(): Promise<void> {
  if (timer) clearTimeout(timer);
  timer = undefined;
  const target = getActiveTarget();
  if (!dirty || !client || !target) return;
  dirty = false;
  try {
    await client.patchRun(target.ownerCode, target.runId, readBox());
  } catch {
    dirty = true;
  }
}

// Saves the box to the active run whenever it changes.
export function startBoxSync(nuzlockeClient: NuzlockeClient): () => void {
  client = nuzlockeClient;
  const onChange = () => {
    if (!getActiveTarget()) return;
    dirty = true;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void flushBoxSync(), SYNC_DELAY_MS);
  };
  const onLeave = () => void flushBoxSync();
  window.addEventListener(BOX_CHANGED_EVENT, onChange);
  window.addEventListener('pagehide', onLeave);
  return () => {
    window.removeEventListener(BOX_CHANGED_EVENT, onChange);
    window.removeEventListener('pagehide', onLeave);
    void flushBoxSync();
  };
}

const ENCOUNTER_SET_PREFIX = 'nuzlocke-';

// Keeps the box in step with the encounters: caught Pokémon get a box entry (edits made
// to it elsewhere are kept), dead or cleared ones are removed from the box and party.
export function syncEncountersToBox(
  encounters: readonly RunEncounter[],
  generation: number,
): void {
  const { box, partyIds } = readBox();
  const wanted = new Map(
    encounters
      .filter((encounter) => encounter.status === 'caught' && encounter.species)
      .map((encounter) => [
        `${ENCOUNTER_SET_PREFIX}${encounter.id}`,
        encounter,
      ]),
  );
  const seen = new Set<string>();
  const partyIdRemap = new Map<string, string>();
  const next: RunBoxSet[] = [];
  for (const set of box) {
    if (!set.id.startsWith(ENCOUNTER_SET_PREFIX)) {
      const matchingEncounter = [...wanted.entries()].find(
        ([id, encounter]) =>
          !seen.has(id) &&
          familyOf(encounter.species!) === familyOf(set.species),
      );
      if (!matchingEncounter) {
        next.push(set);
        continue;
      }
      const [id, encounter] = matchingEncounter;
      seen.add(id);
      partyIdRemap.set(set.id, id);
      next.push({
        ...set,
        id,
        species: encounter.species!,
        nickname: encounter.nickname ?? set.nickname,
      });
      continue;
    }
    const encounter = wanted.get(set.id);
    if (!encounter) continue;
    seen.add(set.id);
    next.push({
      ...set,
      species: encounter.species!,
      nickname: encounter.nickname,
    });
  }
  for (const [id, encounter] of wanted) {
    if (seen.has(id)) continue;
    next.push({
      id,
      generation,
      species: encounter.species!,
      nickname: encounter.nickname,
      level: 100,
      nature: 'Serious',
      evs: emptyStats(0),
      ivs: emptyStats(31),
      moves: [],
    });
  }
  const nextIds = new Set(next.map((set) => set.id));
  const nextParty = partyIds
    .map((id) => partyIdRemap.get(id) ?? id)
    .filter((id) => nextIds.has(id));
  if (JSON.stringify(next) !== JSON.stringify(box)) {
    saveImportedPokemonSets(next as unknown as ImportedPokemonSet[]);
  }
  if (JSON.stringify(nextParty) !== JSON.stringify(partyIds))
    savePartyPokemonSetIds(nextParty);
}

export function notifyActiveRunChanged(): void {
  window.dispatchEvent(new Event(ACTIVE_RUN_CHANGED_EVENT));
}

// Replaces the visible box with the run's box, keeping any scratch box aside for later.
export async function activateRun(run: NuzlockeRun): Promise<boolean> {
  const library = loadPresetLibraryCache();
  if (!library) return false;
  await flushBoxSync();
  if (!loadActiveRun())
    sessionStorage.setItem(SCRATCH_BOX_KEY, JSON.stringify(readBox()));
  writeBox(run.box, run.partyIds);
  localStorage.setItem(
    ACTIVE_RUN_KEY,
    JSON.stringify({
      libraryId: library.snapshot.library.id,
      runId: run.id,
    } satisfies ActiveRun),
  );
  syncEncountersToBox(run.encounters, run.generation);
  notifyActiveRunChanged();
  return true;
}

export async function deactivateRun(): Promise<void> {
  await flushBoxSync();
  const scratch = readJson<{ box?: RunBoxSet[]; partyIds?: string[] }>(
    sessionStorage,
    SCRATCH_BOX_KEY,
    {},
  );
  writeBox(scratch.box ?? [], scratch.partyIds ?? []);
  sessionStorage.removeItem(SCRATCH_BOX_KEY);
  localStorage.removeItem(ACTIVE_RUN_KEY);
  notifyActiveRunChanged();
}

// Reloads the active run's box into this tab, e.g. after a refresh cleared session storage.
export async function restoreActiveRunBox(
  nuzlockeClient: NuzlockeClient,
): Promise<void> {
  const target = getActiveTarget();
  if (!target) return;
  try {
    const run = await nuzlockeClient.getRun(target.ownerCode, target.runId);
    writeBox(run.box, run.partyIds);
  } catch {
    // Offline or deleted: keep whatever box this tab already has.
  }
}
