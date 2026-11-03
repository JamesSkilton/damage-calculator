import { describe, expect, it } from 'vitest';
import {
  loadOneVsOneProgress,
  saveOneVsOneProgress,
} from './oneVsOneProgress';

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

describe('one-vs-one progress persistence', () => {
  it('restores the selected fight for a library', () => {
    const storage = createStorage();
    saveOneVsOneProgress(
      'builtin:run-and-bun:9',
      { trainerName: 'Brock', defenderId: 'brock-1' },
      storage,
    );

    expect(loadOneVsOneProgress('builtin:run-and-bun:9', storage)).toEqual({
      trainerName: 'Brock',
      defenderId: 'brock-1',
    });
  });

  it('keeps progress for separate libraries independent', () => {
    const storage = createStorage();
    saveOneVsOneProgress('builtin:run-and-bun:9', { trainerName: 'Brock' }, storage);

    expect(loadOneVsOneProgress('builtin:radical-red:9', storage)).toEqual({});
  });
});
