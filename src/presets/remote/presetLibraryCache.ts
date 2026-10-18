import type { PresetLibrarySnapshot } from './types';

export const PRESET_LIBRARY_CACHE_KEY = 'pokemans.preset-library-cache.v1';
export const PRESET_LIBRARY_REGISTRY_KEY = 'pokemans.preset-library-registry.v1';

export interface PresetLibraryCacheEntry {
  accessCode: string;
  ownerCode?: string;
  readCode?: string;
  snapshot: PresetLibrarySnapshot;
  cachedAt: string;
}

function resolveStorage(storage?: Storage): Storage | undefined {
  if (storage) return storage;
  return typeof localStorage === 'undefined' ? undefined : localStorage;
}

export function loadPresetLibraryCache(storage?: Storage): PresetLibraryCacheEntry | undefined {
  const target = resolveStorage(storage);
  if (!target) return undefined;
  try {
    const value = JSON.parse(target.getItem(PRESET_LIBRARY_CACHE_KEY) || 'null');
    if (
      value &&
      typeof value.accessCode === 'string' &&
      typeof value.snapshot?.library?.revision === 'number' &&
      Array.isArray(value.snapshot?.presets)
    ) {
      return value as PresetLibraryCacheEntry;
    }
  } catch {
    // Corrupt cache is treated as empty.
  }
  return undefined;
}

export function loadKnownPresetLibraryCaches(
  storage?: Storage,
): PresetLibraryCacheEntry[] {
  const target = resolveStorage(storage);
  if (!target) return [];
  try {
    const value: unknown = JSON.parse(
      target.getItem(PRESET_LIBRARY_REGISTRY_KEY) || '[]',
    );
    if (!Array.isArray(value)) return [];
    const entries = value.filter(
      (entry): entry is PresetLibraryCacheEntry =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof entry.accessCode === 'string' &&
        typeof entry.snapshot?.library?.id === 'string' &&
        typeof entry.snapshot?.library?.revision === 'number' &&
        Array.isArray(entry.snapshot?.presets),
    );
    const active = loadPresetLibraryCache(target);
    return active && !entries.some((entry) => entry.snapshot.library.id === active.snapshot.library.id)
      ? [...entries, active]
      : entries;
  } catch {
    return [];
  }
}

function notifyLibraryChange(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('pokemans.preset-library-changed'));
  }
}

// Never replaces a newer revision of the same library with an older one.
export function savePresetLibraryCache(
  entry: Omit<PresetLibraryCacheEntry, 'cachedAt'>,
  storage?: Storage,
): boolean {
  const target = resolveStorage(storage);
  if (!target) return false;
  const existing = loadPresetLibraryCache(target);
  if (
    existing &&
    existing.snapshot.library.id === entry.snapshot.library.id &&
    existing.snapshot.library.revision > entry.snapshot.library.revision
  ) {
    return false;
  }
  try {
    const saved = { ...entry, cachedAt: new Date().toISOString() };
    target.setItem(
      PRESET_LIBRARY_CACHE_KEY,
      JSON.stringify(saved),
    );
    const known = loadKnownPresetLibraryCaches(target).filter(
      (candidate) => candidate.snapshot.library.id !== saved.snapshot.library.id,
    );
    target.setItem(
      PRESET_LIBRARY_REGISTRY_KEY,
      JSON.stringify([...known, saved]),
    );
    notifyLibraryChange();
    return true;
  } catch {
    return false;
  }

}

export function activateKnownPresetLibrary(
  libraryId: string,
  storage?: Storage,
): PresetLibraryCacheEntry | undefined {
  const target = resolveStorage(storage);
  if (!target) return undefined;
  const entry = loadKnownPresetLibraryCaches(target).find(
    (candidate) => candidate.snapshot.library.id === libraryId,
  );
  if (!entry) return undefined;
  target.setItem(PRESET_LIBRARY_CACHE_KEY, JSON.stringify(entry));
  notifyLibraryChange();
  return entry;
}

export function clearPresetLibraryCache(storage?: Storage): void {
  resolveStorage(storage)?.removeItem(PRESET_LIBRARY_CACHE_KEY);
  notifyLibraryChange();
}
