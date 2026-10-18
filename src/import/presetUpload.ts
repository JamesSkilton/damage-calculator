import type { BattleGeneration, BattleStatId } from 'domain/index';
import type { ImportedPokemonSet } from './pokemonSet';
import { SET_STAT_IDS } from './pokemonSet';
import { formatStatLine, parsePokemonSets } from './pokemonSetParser';

export type UploadFormat = 'showdown' | 'json';

export interface UploadPreset extends ImportedPokemonSet {
  buildName: string;
  sourceFormat: UploadFormat;
}

export interface UploadError {
  index: number;
  label: string;
  messages: string[];
}

export interface UploadPreview {
  format: UploadFormat;
  generation: BattleGeneration;
  presets: UploadPreset[];
  duplicates: UploadPreset[];
  errors: UploadError[];
}

export const PRESET_JSON_SCHEMA_VERSION = 1;
export const MAX_UPLOAD_CHARACTERS = 1_000_000;
export const MAX_UPLOAD_PRESETS = 500;

export function detectUploadFormat(text: string): UploadFormat {
  const trimmed = text.trimStart();
  return trimmed.startsWith('{') || trimmed.startsWith('[') ? 'json' : 'showdown';
}

export function presetIdentityKey(
  set: Pick<ImportedPokemonSet, 'generation' | 'species' | 'buildName'>,
): string {
  return `${set.generation}|${set.species.toLowerCase()}|${(set.buildName ?? '').toLowerCase()}`;
}

type RawRecord = Record<string, unknown>;

function isRecord(value: unknown): value is RawRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readStats(
  value: unknown,
  field: string,
  max: number,
  messages: string[],
): Partial<Record<BattleStatId, number>> {
  const stats: Partial<Record<BattleStatId, number>> = {};
  if (value === undefined) return stats;
  if (!isRecord(value)) {
    messages.push(`${field} must be an object.`);
    return stats;
  }
  for (const [key, raw] of Object.entries(value)) {
    if (!(SET_STAT_IDS as readonly string[]).includes(key)) {
      messages.push(`${field} has unknown stat "${key}".`);
    } else if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 0 || raw > max) {
      messages.push(`${field}.${key} must be an integer from 0 to ${max}.`);
    } else {
      stats[key as BattleStatId] = raw;
    }
  }
  return stats;
}

function optionalString(value: unknown, field: string, messages: string[]): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') {
    messages.push(`${field} must be a string.`);
    return undefined;
  }
  return value.trim() || undefined;
}

export const MAX_PRESET_INDEX = 1_000_000;

function optionalIndex(value: unknown, messages: string[]): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > MAX_PRESET_INDEX) {
    messages.push(`index must be an integer from 0 to ${MAX_PRESET_INDEX}.`);
    return undefined;
  }
  return value;
}

function jsonRecordToShowdown(
  record: RawRecord,
  messages: string[],
): {
  text: string;
  buildName?: string;
  trainerName?: string;
  index?: number;
  sourcePresetId?: string;
  sourceLibraryId?: string;
} | undefined {
  const species = optionalString(record.species, 'species', messages);
  if (!species) {
    messages.push('species is required.');
    return undefined;
  }
  const buildName = optionalString(record.buildName, 'buildName', messages);
  const trainerName = optionalString(record.trainerName, 'trainerName', messages);
  const index = optionalIndex(record.index, messages);
  const sourcePresetId = optionalString(record.sourcePresetId, 'sourcePresetId', messages);
  const sourceLibraryId = optionalString(record.sourceLibraryId, 'sourceLibraryId', messages);
  const nickname = optionalString(record.nickname, 'nickname', messages);
  const gender = optionalString(record.gender, 'gender', messages);
  if (gender && gender !== 'M' && gender !== 'F' && gender !== 'N') {
    messages.push('gender must be M, F, or N.');
  }
  const item = optionalString(record.item, 'item', messages);
  const ability = optionalString(record.ability, 'ability', messages);
  const nature = optionalString(record.nature, 'nature', messages);
  const teraType = optionalString(record.teraType, 'teraType', messages);
  const evs = readStats(record.evs, 'evs', 252, messages);
  const ivs = readStats(record.ivs, 'ivs', 31, messages);

  let level: number | undefined;
  if (record.level !== undefined) {
    if (typeof record.level === 'number' && Number.isInteger(record.level) && record.level >= 1 && record.level <= 100) {
      level = record.level;
    } else {
      messages.push('level must be an integer from 1 to 100.');
    }
  }

  const moves: string[] = [];
  if (!Array.isArray(record.moves)) {
    messages.push('moves must be an array.');
  } else {
    if (record.moves.length > 4) messages.push('A preset can have at most 4 moves.');
    for (const move of record.moves) {
      if (typeof move === 'string' && move.trim()) moves.push(move.trim());
      else messages.push('moves must contain non-empty strings.');
    }
  }
  if (messages.length > 0) return undefined;

  const name = nickname && nickname !== species ? `${nickname} (${species})` : species;
  const lines = [
    `${name}${gender === 'M' || gender === 'F' ? ` (${gender})` : ''}${item ? ` @ ${item}` : ''}`,
  ];
  if (ability) lines.push(`Ability: ${ability}`);
  if (level !== undefined) lines.push(`Level: ${level}`);
  if (teraType) lines.push(`Tera Type: ${teraType}`);
  const evLine = formatStatLine(evs as never, (value) => value > 0);
  if (evLine) lines.push(`EVs: ${evLine}`);
  if (nature) lines.push(`${nature} Nature`);
  const ivLine = formatStatLine(ivs as never, (value) => value !== undefined);
  if (ivLine) lines.push(`IVs: ${ivLine}`);
  for (const move of moves) lines.push(`- ${move}`);
  return { text: lines.join('\n'), buildName, trainerName, index, sourcePresetId, sourceLibraryId };
}

function checkSetRanges(set: ImportedPokemonSet, messages: string[]): void {
  let evTotal = 0;
  for (const stat of SET_STAT_IDS) {
    if (set.evs[stat] < 0 || set.evs[stat] > 252) messages.push(`EV for ${stat} must be 0-252.`);
    if (set.ivs[stat] < 0 || set.ivs[stat] > 31) messages.push(`IV for ${stat} must be 0-31.`);
    evTotal += set.evs[stat];
  }
  if (evTotal > 510) messages.push(`EV total ${evTotal} exceeds 510.`);
}

function finishSet(
  text: string,
  generation: BattleGeneration,
  format: UploadFormat,
  buildName: string | undefined,
  metadata: Pick<UploadPreset, 'trainerName' | 'index' | 'sourcePresetId' | 'sourceLibraryId'>,
  extraMessages: string[],
): { preset?: UploadPreset; messages: string[] } {
  const result = parsePokemonSets(text, generation);
  const messages = [...extraMessages, ...result.errors];
  const set = result.sets[0];
  if (!set) return { messages };
  checkSetRanges(set, messages);
  if (messages.length > 0) return { messages };
  return {
    preset: {
      ...set,
      buildName: buildName || set.nickname || set.species,
      sourceFormat: format,
      ...metadata,
    },
    messages,
  };
}

function splitShowdownBlocks(text: string): string[] {
  return text.split(/\r?\n\s*\r?\n/).map((block) => block.trim()).filter(Boolean);
}

function blockLabel(block: string, index: number): string {
  return `Set ${index + 1} (${block.split(/\r?\n/)[0].trim().slice(0, 40)})`;
}

export function parseUpload(
  text: string,
  generation: BattleGeneration,
  existing: readonly Pick<ImportedPokemonSet, 'generation' | 'species' | 'buildName'>[] = [],
): UploadPreview {
  const format = detectUploadFormat(text);
  const errors: UploadError[] = [];
  const candidates: UploadPreset[] = [];
  let effectiveGeneration = generation;

  if (text.length > MAX_UPLOAD_CHARACTERS) {
    errors.push({ index: 0, label: 'Upload', messages: ['File is too large.'] });
    return { format, generation, presets: [], duplicates: [], errors };
  }

  if (format === 'showdown') {
    const blocks = splitShowdownBlocks(text);
    if (blocks.length > MAX_UPLOAD_PRESETS) {
      errors.push({ index: 0, label: 'Upload', messages: [`At most ${MAX_UPLOAD_PRESETS} presets per upload.`] });
    } else {
      blocks.forEach((block, index) => {
        const { preset, messages } = finishSet(block, generation, 'showdown', undefined, {}, []);
        if (preset) candidates.push(preset);
        else errors.push({ index, label: blockLabel(block, index), messages });
      });
    }
  } else {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = undefined;
      errors.push({ index: 0, label: 'Upload', messages: ['Invalid JSON.'] });
    }
    if (parsed !== undefined) {
      if (!isRecord(parsed) || parsed.schemaVersion !== PRESET_JSON_SCHEMA_VERSION) {
        errors.push({
          index: 0,
          label: 'Upload',
          messages: [`Expected an object with schemaVersion ${PRESET_JSON_SCHEMA_VERSION}.`],
        });
      } else if (!Array.isArray(parsed.presets)) {
        errors.push({ index: 0, label: 'Upload', messages: ['"presets" must be an array.'] });
      } else if (parsed.presets.length > MAX_UPLOAD_PRESETS) {
        errors.push({ index: 0, label: 'Upload', messages: [`At most ${MAX_UPLOAD_PRESETS} presets per upload.`] });
      } else {
        const generationValue = parsed.generation;
        if (generationValue !== undefined) {
          if (
            typeof generationValue === 'number' &&
            Number.isInteger(generationValue) &&
            generationValue >= 1 &&
            generationValue <= 9
          ) {
            effectiveGeneration = generationValue as BattleGeneration;
          } else {
            errors.push({ index: 0, label: 'Upload', messages: ['generation must be an integer from 1 to 9.'] });
          }
        }
        if (errors.length === 0) {
          parsed.presets.forEach((raw: unknown, index: number) => {
            const label = `Preset ${index + 1}`;
            if (!isRecord(raw)) {
              errors.push({ index, label, messages: ['Preset must be an object.'] });
              return;
            }
            const messages: string[] = [];
            const converted = jsonRecordToShowdown(raw, messages);
            if (!converted) {
              errors.push({ index, label, messages });
              return;
            }
            const { preset, messages: setMessages } = finishSet(
              converted.text,
              effectiveGeneration,
              'json',
              converted.buildName,
              converted,
              [],
            );
            if (preset) candidates.push(preset);
            else errors.push({ index, label, messages: setMessages });
          });
        }
      }
    }
  }

  const seen = new Set(existing.map(presetIdentityKey));
  const presets: UploadPreset[] = [];
  const duplicates: UploadPreset[] = [];
  candidates.forEach((candidate, index) => {
    const key = presetIdentityKey(candidate);
    if (seen.has(key)) {
      duplicates.push(candidate);
      return;
    }
    seen.add(key);
    presets.push({ ...candidate, id: `${candidate.id}-${index}` });
  });

  return { format, generation: effectiveGeneration, presets, duplicates, errors };
}

export function serializePresetsAsJson(
  presets: readonly ImportedPokemonSet[],
  generation: BattleGeneration,
): string {
  return JSON.stringify(
    {
      schemaVersion: PRESET_JSON_SCHEMA_VERSION,
      generation,
      presets: presets
        .filter((set) => set.generation === generation)
        .map((set) => ({
          species: set.species,
          buildName: set.buildName,
          trainerName: set.trainerName,
          index: set.index,
          sourcePresetId: set.sourcePresetId,
          sourceLibraryId: set.sourceLibraryId,
          nickname: set.nickname,
          level: set.level,
          gender: set.gender,
          ability: set.ability,
          item: set.item,
          nature: set.nature,
          teraType: set.teraType,
          evs: set.evs,
          ivs: set.ivs,
          moves: set.moves,
        })),
    },
    null,
    2,
  );
}
