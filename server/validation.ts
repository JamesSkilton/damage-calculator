import type { BattleGeneration } from 'domain/index';
import { MAX_PRESET_INDEX, parseUpload, type UploadPreset } from '../src/import/presetUpload';

export { MAX_PRESET_INDEX };
export { validateBaseStatEntries } from '../src/presets/baseStats';

export const MAX_BATCH_PRESETS = 500;
export const MAX_LIBRARY_PRESETS = 2000;
export const MAX_NAME_LENGTH = 80;

export type StoredPreset = Omit<UploadPreset, 'id' | 'remote'>;

export interface ValidationResult {
  preset?: StoredPreset;
  messages: string[];
}

// Re-validates a client-supplied preset with the same rules the upload pipeline uses.
export function validatePreset(input: unknown): ValidationResult {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { messages: ['Preset must be an object.'] };
  }
  const record = input as Record<string, unknown>;
  const generation = record.generation;
  if (typeof generation !== 'number' || !Number.isInteger(generation) || generation < 1 || generation > 9) {
    return { messages: ['generation must be an integer from 1 to 9.'] };
  }
  const sourceFormat = record.sourceFormat === 'json' ? 'json' : 'showdown';
  const preview = parseUpload(
    JSON.stringify({ schemaVersion: 1, generation, presets: [record] }),
    generation as BattleGeneration,
  );
  const preset = preview.presets[0];
  if (!preset) {
    return { messages: preview.errors.flatMap((entry) => entry.messages) };
  }
  const { id: _id, remote: _remote, ...rest } = preset;
  void _id;
  void _remote;
  const metadata = ['trainerName', 'sourcePresetId', 'sourceLibraryId'] as const;
  for (const field of metadata) {
    if (record[field] !== undefined && typeof record[field] !== 'string') {
      return { messages: [`${field} must be a string.`] };
    }
  }
  return {
    preset: {
      ...rest,
      sourceFormat,
      trainerName: record.trainerName as string | undefined,
      sourcePresetId: record.sourcePresetId as string | undefined,
      sourceLibraryId: record.sourceLibraryId as string | undefined,
    },
    messages: [],
  };
}
