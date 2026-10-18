import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHttpPresetLibraryRepository } from './httpRepository';
import {
  activateKnownPresetLibrary,
  loadKnownPresetLibraryCaches,
  loadPresetLibraryCache,
  savePresetLibraryCache,
} from './presetLibraryCache';
import { PresetLibraryError, type PresetLibrarySnapshot } from './types';

const library = (revision: number) => ({
  id: 'lib',
  name: 'L',
  createdAt: '',
  updatedAt: '',
  revision,
  presetCount: 0,
});
const snapshot = (revision: number): PresetLibrarySnapshot => ({ library: library(revision), presets: [] });

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => Array.from(data.keys())[index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, value),
  };
}

describe('presetLibraryCache', () => {
  let storage: Storage;
  beforeEach(() => {
    storage = memoryStorage();
  });

  it('round trips and never replaces a newer revision', () => {
    expect(savePresetLibraryCache({ accessCode: 'a', snapshot: snapshot(3) }, storage)).toBe(true);
    expect(savePresetLibraryCache({ accessCode: 'a', snapshot: snapshot(2) }, storage)).toBe(false);
    expect(loadPresetLibraryCache(storage)?.snapshot.library.revision).toBe(3);
    expect(savePresetLibraryCache({ accessCode: 'a', snapshot: snapshot(4) }, storage)).toBe(true);
  });

  it('ignores corrupt cache', () => {
    storage.setItem('pokemans.preset-library-cache.v1', '{bad');
    expect(loadPresetLibraryCache(storage)).toBeUndefined();
  });

  it('keeps multiple known libraries and activates the chosen one', () => {
    const first = snapshot(1);
    const second = {
      library: { ...library(1), id: 'lib-2', name: 'Second' },
      presets: [],
    };
    savePresetLibraryCache({ accessCode: 'first', snapshot: first }, storage);
    savePresetLibraryCache({ accessCode: 'second', snapshot: second }, storage);

    expect(loadKnownPresetLibraryCaches(storage).map((entry) => entry.snapshot.library.id))
      .toEqual(['lib', 'lib-2']);
    expect(activateKnownPresetLibrary('lib', storage)?.accessCode).toBe('first');
    expect(loadPresetLibraryCache(storage)?.accessCode).toBe('first');
  });
});

describe('http repository', () => {
  const respond = (status: number, body: unknown = {}) =>
    vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(
      async () => new Response(JSON.stringify(body), { status }),
    );

  it('opens a library', async () => {
    const fetchMock = respond(200, { library: library(1), presets: [] });
    const repo = createHttpPresetLibraryRepository('https://x.test/', fetchMock);
    expect((await repo.open('abc')).library.revision).toBe(1);
    expect(fetchMock.mock.calls[0][0]).toBe('https://x.test/api/preset-libraries/abc');
  });

  it('maps statuses to error kinds', async () => {
    const kind = async (status: number) => {
      try {
        await createHttpPresetLibraryRepository('https://x.test', respond(status)).open('c');
      } catch (error) {
        return (error as PresetLibraryError).kind;
      }
    };
    expect(await kind(404)).toBe('invalid-code');
    expect(await kind(409)).toBe('conflict');
    expect(await kind(500)).toBe('server');
  });

  it('maps fetch failures to network errors', async () => {
    const repo = createHttpPresetLibraryRepository('https://x.test', async () => {
      throw new TypeError('offline');
    });
    await expect(repo.open('c')).rejects.toMatchObject({ kind: 'network' });
  });

  it('sends idempotency key and revision on upload', async () => {
    const fetchMock = respond(200, { library: library(2), created: [], duplicates: [], errors: [] });
    await createHttpPresetLibraryRepository('https://x.test', fetchMock).upload('own', [], {
      revision: 1,
      idempotencyKey: 'k',
    });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>)['Idempotency-Key']).toBe('k');
    expect(JSON.parse(init.body as string).revision).toBe(1);
  });
});
