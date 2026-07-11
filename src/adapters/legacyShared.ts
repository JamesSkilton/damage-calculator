import type { BattleGeneration } from '../domain';

export interface LegacyLookup<T> {
  get(id: string): T | undefined;
}

export interface LegacyGeneration<SpeciesT = unknown, MoveT = unknown> {
  num: BattleGeneration;
  species: LegacyLookup<SpeciesT>;
  moves: LegacyLookup<MoveT>;
}

export function toLegacyId(text: string): string {
  const lower = `${text}`.toLowerCase();

  if (lower === 'flabébé') {
    return 'flabebe';
  }

  return lower.replace(/[^a-z0-9]+/g, '');
}

export function isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function mergeLegacy<T extends object>(
  base: T,
  overrides?: Partial<T>,
): T {
  if (!overrides) {
    return { ...base };
  }

  const merged: Record<string, unknown> = {
    ...(base as Record<string, unknown>),
  };

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      continue;
    }

    const current = merged[key];
    if (isPlainObject(current) && isPlainObject(value)) {
      merged[key] = mergeLegacy(
        current as object,
        value as Record<string, unknown>,
      );
      continue;
    }

    if (Array.isArray(current) && Array.isArray(value)) {
      merged[key] = [...value];
      continue;
    }

    merged[key] = value;
  }

  return merged as T;
}
