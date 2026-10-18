import type { BattleGeneration, BattleStatId, BattleStats } from 'domain/index';

export interface SpeciesBaseStats {
  generation: BattleGeneration;
  species: string;
  baseStats: BattleStats;
}

export const BASE_STAT_IDS: readonly BattleStatId[] = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
export const BASE_STATS_SCHEMA_VERSION = 1;
export const MAX_BASE_STAT_VALUE = 255;
export const MAX_BASE_STAT_ENTRIES = 2000;
export const MAX_BASE_STAT_UPLOAD_CHARACTERS = 1_000_000;

type RawRecord = Record<string, unknown>;

function isRecord(value: unknown): value is RawRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export const baseStatKey = (generation: number, species: string): string =>
  `${generation}|${species.trim().toLowerCase()}`;

export function findBaseStatOverride(
  entries: readonly SpeciesBaseStats[] | undefined,
  generation: number,
  species: string,
): BattleStats | undefined {
  const key = baseStatKey(generation, species);
  return entries?.find((entry) => baseStatKey(entry.generation, entry.species) === key)?.baseStats;
}

export function applyLibraryBaseStats<T extends { generation: number; species: string; baseStats?: BattleStats }>(
  combatant: T,
  entries: readonly SpeciesBaseStats[] | undefined,
): T {
  const baseStats = findBaseStatOverride(entries, combatant.generation, combatant.species);
  if (baseStats === combatant.baseStats) return combatant;
  return { ...combatant, baseStats };
}

// Only stat ids in `partial` are validated; missing ones fall back to `fallback` when provided.
function readBaseStats(
  value: unknown,
  fallback: BattleStats | undefined,
  generation: number,
  messages: string[],
): BattleStats | undefined {
  if (!isRecord(value)) {
    messages.push('baseStats must be an object.');
    return undefined;
  }
  const result: Partial<Record<BattleStatId, number>> = {};
  for (const key of Object.keys(value)) {
    if (!(BASE_STAT_IDS as readonly string[]).includes(key)) messages.push(`baseStats has unknown stat "${key}".`);
  }
  for (const stat of BASE_STAT_IDS) {
    const raw = value[stat] ?? fallback?.[stat];
    if (raw === undefined) {
      messages.push(`baseStats.${stat} is required.`);
    } else if (
      typeof raw !== 'number' ||
      !Number.isInteger(raw) ||
      raw < 1 ||
      raw > MAX_BASE_STAT_VALUE
    ) {
      messages.push(`baseStats.${stat} must be an integer from 1 to ${MAX_BASE_STAT_VALUE}.`);
    } else {
      result[stat] = raw;
    }
  }
  if (messages.length === 0 && generation <= 2 && result.spa !== result.spd) {
    messages.push('Sp. Atk and Sp. Def must match in Gen 1 and Gen 2.');
  }
  return messages.length === 0 ? (result as BattleStats) : undefined;
}

function readEntry(
  value: unknown,
  generation: number,
  resolveDefault: ((species: string) => { name: string; baseStats: BattleStats } | undefined) | undefined,
  messages: string[],
): SpeciesBaseStats | undefined {
  if (!isRecord(value)) {
    messages.push('Entry must be an object.');
    return undefined;
  }
  const rawSpecies = typeof value.species === 'string' ? value.species.trim() : '';
  if (!rawSpecies || rawSpecies.length > 100) {
    messages.push('species is required (max 100 characters).');
    return undefined;
  }
  let species = rawSpecies;
  let fallback: BattleStats | undefined;
  if (resolveDefault) {
    const known = resolveDefault(rawSpecies);
    if (!known) {
      messages.push(`Unknown species "${rawSpecies}" in Gen ${generation}.`);
      return undefined;
    }
    species = known.name;
    fallback = known.baseStats;
  }
  const baseStats = readBaseStats(value.baseStats, fallback, generation, messages);
  return baseStats ? { generation: generation as BattleGeneration, species, baseStats } : undefined;
}

// Strict validation for data coming from the server or an untrusted client: every stat is required.
export function validateBaseStatEntries(value: unknown): {
  entries: SpeciesBaseStats[];
  messages: string[];
} {
  if (!Array.isArray(value)) return { entries: [], messages: ['baseStats must be an array.'] };
  if (value.length > MAX_BASE_STAT_ENTRIES) {
    return { entries: [], messages: [`At most ${MAX_BASE_STAT_ENTRIES} base stat entries are allowed.`] };
  }
  const entries: SpeciesBaseStats[] = [];
  const messages: string[] = [];
  const seen = new Set<string>();
  value.forEach((raw, index) => {
    const problems: string[] = [];
    const generation = isRecord(raw) ? raw.generation : undefined;
    if (typeof generation !== 'number' || !Number.isInteger(generation) || generation < 1 || generation > 9) {
      problems.push('generation must be an integer from 1 to 9.');
    } else {
      const entry = readEntry(raw, generation, undefined, problems);
      if (entry) {
        const key = baseStatKey(entry.generation, entry.species);
        if (seen.has(key)) problems.push(`${entry.species} appears more than once for Gen ${generation}.`);
        seen.add(key);
        if (problems.length === 0) entries.push(entry);
      }
    }
    messages.push(...problems.map((message) => `Entry ${index + 1}: ${message}`));
  });
  return { entries, messages };
}

export interface BaseStatsUploadResult {
  entries: SpeciesBaseStats[];
  errors: string[];
}

// Accepts `{ generation?, baseStats: [{ species, baseStats }] }` or a bare array.
// Stats left out of an entry keep the game's default for that species.
export function parseBaseStatsUpload(
  text: string,
  generation: BattleGeneration,
  resolveDefault: (species: string) => { name: string; baseStats: BattleStats } | undefined,
): BaseStatsUploadResult {
  if (text.length > MAX_BASE_STAT_UPLOAD_CHARACTERS) {
    return { entries: [], errors: ['The upload is too large.'] };
  }
  let document: unknown;
  try {
    document = JSON.parse(text);
  } catch {
    return { entries: [], errors: ['The upload is not valid JSON.'] };
  }
  let list: unknown;
  if (Array.isArray(document)) {
    list = document;
  } else if (isRecord(document)) {
    if (document.generation !== undefined && document.generation !== generation) {
      return { entries: [], errors: [`The upload is for Gen ${String(document.generation)}, not Gen ${generation}.`] };
    }
    list = document.baseStats;
  }
  if (!Array.isArray(list)) return { entries: [], errors: ['Expected a "baseStats" array.'] };
  if (list.length === 0) return { entries: [], errors: ['The upload contains no entries.'] };
  if (list.length > MAX_BASE_STAT_ENTRIES) {
    return { entries: [], errors: [`At most ${MAX_BASE_STAT_ENTRIES} entries are allowed.`] };
  }

  const entries = new Map<string, SpeciesBaseStats>();
  const errors: string[] = [];
  list.forEach((raw, index) => {
    const problems: string[] = [];
    const entry = readEntry(raw, generation, resolveDefault, problems);
    if (entry) entries.set(baseStatKey(generation, entry.species), entry);
    const label = isRecord(raw) && typeof raw.species === 'string' ? raw.species : `Entry ${index + 1}`;
    errors.push(...problems.map((message) => `${label}: ${message}`));
  });
  return { entries: [...entries.values()], errors };
}

// Incoming entries replace existing ones for the same generation and species.
export function mergeBaseStatEntries(
  existing: readonly SpeciesBaseStats[],
  incoming: readonly SpeciesBaseStats[],
): SpeciesBaseStats[] {
  const merged = new Map(existing.map((entry) => [baseStatKey(entry.generation, entry.species), entry]));
  for (const entry of incoming) merged.set(baseStatKey(entry.generation, entry.species), entry);
  return [...merged.values()];
}

export function serializeBaseStats(entries: readonly SpeciesBaseStats[], generation: BattleGeneration): string {
  return JSON.stringify(
    {
      schemaVersion: BASE_STATS_SCHEMA_VERSION,
      generation,
      baseStats: entries
        .filter((entry) => entry.generation === generation)
        .map(({ species, baseStats }) => ({ species, baseStats })),
    },
    null,
    2,
  );
}
