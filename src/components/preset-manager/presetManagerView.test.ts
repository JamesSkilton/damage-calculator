import { beforeEach, describe, expect, it } from 'vitest';
import {
  loadPresetManagerView,
  PRESET_MANAGER_VIEW_KEY,
  savePresetManagerView,
} from './presetManagerView';

function createStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}

describe('preset manager view persistence', () => {
  let storage: Storage;

  beforeEach(() => {
    storage = createStorage();
  });

  it('restores the library view after leaving the page', () => {
    savePresetManagerView({ kind: 'library' }, storage);

    expect(loadPresetManagerView(storage)).toEqual({ kind: 'library' });
  });

  it('restores a built-in library view', () => {
    savePresetManagerView({ kind: 'builtin', libraryId: 'run-and-bun' }, storage);

    expect(loadPresetManagerView(storage)).toEqual({
      kind: 'builtin',
      libraryId: 'run-and-bun',
    });
  });

  it('falls back to the catalog for invalid state', () => {
    storage.setItem(PRESET_MANAGER_VIEW_KEY, '{"kind":"unexpected"}');

    expect(loadPresetManagerView(storage)).toEqual({ kind: 'catalog' });
  });
});
