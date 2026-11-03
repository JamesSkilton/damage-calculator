export type OneVsOneProgress = {
  trainerName?: string;
  defenderId?: string;
};

const STORAGE_KEY = 'pokemans.one-vs-one-progress.v1';

type StoredProgress = Record<string, OneVsOneProgress>;

function resolveStorage(storage?: Storage): Storage | undefined {
  if (storage) return storage;
  return typeof sessionStorage === 'undefined' ? undefined : sessionStorage;
}

function read(storage?: Storage): StoredProgress {
  const target = resolveStorage(storage);
  if (!target) return {};
  try {
    const value: unknown = JSON.parse(target.getItem(STORAGE_KEY) || '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value as StoredProgress;
  } catch {
    return {};
  }
}

export function loadOneVsOneProgress(
  key: string,
  storage?: Storage,
): OneVsOneProgress {
  const value = read(storage)[key];
  if (!value || typeof value !== 'object') return {};
  return {
    trainerName: typeof value.trainerName === 'string' ? value.trainerName : undefined,
    defenderId: typeof value.defenderId === 'string' ? value.defenderId : undefined,
  };
}

export function saveOneVsOneProgress(
  key: string,
  progress: OneVsOneProgress,
  storage?: Storage,
): void {
  const target = resolveStorage(storage);
  if (!target) return;
  try {
    target.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...read(target), [key]: progress }),
    );
  } catch {
    // Session storage is best effort.
  }
}
