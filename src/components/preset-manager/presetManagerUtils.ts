import type { BattleGeneration } from 'domain/index';
import type { ImportedPokemonSet } from '../../import/pokemonSet';
import { presetIdentityKey, type UploadPreset } from '../../import/presetUpload';
import type { PresetInput, UserPreset } from '../../presets/remote/types';

export interface TrainerGroup {
  // Empty string groups presets that have no trainer name.
  trainerName: string;
  presets: UserPreset[];
}

export interface LibraryStats {
  trainers: number;
  pokemon: number;
  generations: BattleGeneration[];
}

export const NO_TRAINER_LABEL = 'No trainer';

const indexOf = (preset: UserPreset): number => preset.index ?? Number.POSITIVE_INFINITY;

// Trainers follow fight order (lowest preset index first); un-ordered trainers
// come next alphabetically, and presets without a trainer are always last.
export function groupPresetsByTrainer(presets: readonly UserPreset[]): TrainerGroup[] {
  const groups = new Map<string, UserPreset[]>();
  for (const preset of presets) {
    const name = preset.trainerName?.trim() ?? '';
    groups.set(name, [...(groups.get(name) ?? []), preset]);
  }
  return Array.from(groups, ([trainerName, items]) => ({
    trainerName,
    presets: [...items].sort(
      (left, right) => indexOf(left) - indexOf(right) || left.species.localeCompare(right.species),
    ),
  })).sort((left, right) => {
    if ((left.trainerName === '') !== (right.trainerName === '')) return left.trainerName === '' ? 1 : -1;
    const leftIndex = indexOf(left.presets[0]);
    const rightIndex = indexOf(right.presets[0]);
    if (leftIndex !== rightIndex) return leftIndex < rightIndex ? -1 : 1;
    return left.trainerName.localeCompare(right.trainerName);
  });
}

export function nextTrainerIndex(presets: readonly UserPreset[]): number {
  return presets.reduce((max, preset) => Math.max(max, preset.index ?? 0), 0) + 1;
}

// Moves one trainer and returns only the presets whose index changes. Every
// trainer in the list gets index = position + 1 so "Fight N" matches the list.
export function planTrainerMove(
  groups: readonly TrainerGroup[],
  trainerName: string,
  direction: -1 | 1,
): { id: string; index: number }[] {
  const ordered = groups.filter((group) => group.trainerName !== '');
  const from = ordered.findIndex((group) => group.trainerName === trainerName);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= ordered.length) return [];
  const next = [...ordered];
  [next[from], next[to]] = [next[to], next[from]];
  return next.flatMap((group, position) =>
    group.presets
      .filter((preset) => preset.index !== position + 1)
      .map((preset) => ({ id: preset.id, index: position + 1 })),
  );
}

export function summarizeLibrary(presets: readonly UserPreset[]): LibraryStats {
  const trainers = new Set<string>();
  const generations = new Set<BattleGeneration>();
  for (const preset of presets) {
    const name = preset.trainerName?.trim();
    if (name) trainers.add(name.toLowerCase());
    generations.add(preset.generation);
  }
  return {
    trainers: trainers.size,
    pokemon: presets.length,
    generations: Array.from(generations).sort((left, right) => left - right),
  };
}

export function uniqueBuildName(
  base: string,
  species: string,
  generation: BattleGeneration,
  existing: readonly Pick<ImportedPokemonSet, 'generation' | 'species' | 'buildName'>[],
): string {
  const taken = new Set(existing.map(presetIdentityKey));
  let name = base;
  let suffix = 2;
  while (taken.has(presetIdentityKey({ generation, species, buildName: name }))) {
    name = `${base} ${suffix}`;
    suffix += 1;
  }
  return name;
}

export function toInput(preset: UploadPreset): PresetInput {
  const { id: _id, remote: _remote, ...rest } = preset;
  void _id;
  void _remote;
  return rest;
}

export function localToUpload(set: ImportedPokemonSet): UploadPreset {
  return { ...set, buildName: set.nickname || set.species, sourceFormat: 'showdown' };
}

const CLEARABLE_FIELDS = ['nickname', 'gender', 'ability', 'item', 'teraType', 'trainerName'] as const;

// The server merges PATCH changes into the stored preset, so cleared optional
// fields must be sent as null; undefined is dropped by JSON and keeps the old value.
export function toUpdateChanges(input: PresetInput): Partial<PresetInput> {
  const changes: Record<string, unknown> = { ...input };
  for (const field of CLEARABLE_FIELDS) {
    if (changes[field] === undefined) changes[field] = null;
  }
  return changes as Partial<PresetInput>;
}
