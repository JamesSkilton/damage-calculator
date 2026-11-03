import { presetLibraries, type PresetLibraryId } from '../../import/legacySets/legacyPresetCatalog';

export type PresetManagerView =
  | { kind: 'catalog' }
  | { kind: 'library' }
  | { kind: 'builtin'; libraryId: PresetLibraryId }
  | { kind: 'trainer'; trainerName: string | undefined; session: number };

export const PRESET_MANAGER_VIEW_KEY = 'pokemans.preset-manager-view.v1';

function resolveStorage(storage?: Storage): Storage | undefined {
  if (storage) return storage;
  return typeof sessionStorage === 'undefined' ? undefined : sessionStorage;
}

export function loadPresetManagerView(
  storage?: Storage,
): PresetManagerView {
  const target = resolveStorage(storage);
  if (!target) return { kind: 'catalog' };

  try {
    const value: unknown = JSON.parse(
      target.getItem(PRESET_MANAGER_VIEW_KEY) || 'null',
    );
    if (!value || typeof value !== 'object' || !('kind' in value)) {
      return { kind: 'catalog' };
    }
    const candidate = value as { kind: unknown; libraryId?: unknown };
    if (candidate.kind === 'library' || candidate.kind === 'catalog') {
      return { kind: candidate.kind };
    }
    if (
      candidate.kind === 'builtin' &&
      typeof candidate.libraryId === 'string' &&
      presetLibraries.some((library) => library.id === candidate.libraryId)
    ) {
      return { kind: 'builtin', libraryId: candidate.libraryId as PresetLibraryId };
    }
    if (candidate.kind === 'trainer') return { kind: 'library' };
  } catch {
    // Invalid view state is treated as the default catalog.
  }
  return { kind: 'catalog' };
}

export function savePresetManagerView(
  view: PresetManagerView,
  storage?: Storage,
): void {
  const target = resolveStorage(storage);
  if (!target) return;
  try {
    target.setItem(
      PRESET_MANAGER_VIEW_KEY,
      JSON.stringify(view.kind === 'trainer' ? { kind: 'library' } : view),
    );
  } catch {
    // Session storage may be unavailable or full; view state is best effort.
  }
}
