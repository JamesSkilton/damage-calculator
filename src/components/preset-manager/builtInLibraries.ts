import type { BattleGeneration } from 'domain/index';
import {
  extractPresetTrainerName,
  getPokemonPresets,
  type PokemonPreset,
  type PresetLibrary,
  type PresetLibraryId,
} from '../../import/legacySets/legacyPresetCatalog';

export interface BuiltInStats {
  groups: number;
  groupLabel: 'Trainers' | 'Species';
  pokemon: number;
  generations: BattleGeneration[];
}

export interface BuiltInGroup {
  key: string;
  label: string;
  presets: PokemonPreset[];
}

// The standard library has no trainers; its sets are browsed by species instead.
export function builtInHasTrainers(libraryId: PresetLibraryId): boolean {
  return libraryId !== 'standard';
}

export function summarizeBuiltInLibrary(library: PresetLibrary): BuiltInStats {
  const hasTrainers = builtInHasTrainers(library.id);
  const groups = new Set<string>();
  let pokemon = 0;
  for (const source of library.sources) {
    for (const [species, builds] of Object.entries(source.sets)) {
      for (const buildName of Object.keys(builds)) {
        pokemon += 1;
        groups.add(hasTrainers ? extractPresetTrainerName(buildName) : species);
      }
    }
  }
  return {
    groups: groups.size,
    groupLabel: hasTrainers ? 'Trainers' : 'Species',
    pokemon,
    generations: library.sources.map((source) => source.generation).sort((left, right) => left - right),
  };
}

export function groupBuiltInPresets(
  libraryId: PresetLibraryId,
  generation: BattleGeneration,
  availableSpecies?: readonly { name: string }[],
): BuiltInGroup[] {
  const presets = getPokemonPresets(libraryId, generation, availableSpecies);
  const hasTrainers = builtInHasTrainers(libraryId);
  const groups = new Map<string, BuiltInGroup>();
  for (const preset of presets) {
    const label = hasTrainers ? preset.trainerName || 'Unknown trainer' : preset.species;
    const group = groups.get(label) ?? { key: label, label, presets: [] };
    group.presets.push(preset);
    groups.set(label, group);
  }
  const firstIndex = (group: BuiltInGroup) =>
    Math.min(...group.presets.map((preset) => preset.index ?? Number.POSITIVE_INFINITY));
  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      presets: hasTrainers
        ? [...group.presets].sort(
            (left, right) =>
              (left.index ?? Number.POSITIVE_INFINITY) - (right.index ?? Number.POSITIVE_INFINITY) ||
              left.species.localeCompare(right.species),
          )
        : group.presets,
    }))
    .sort((left, right) =>
      hasTrainers
        ? firstIndex(left) - firstIndex(right) || left.label.localeCompare(right.label)
        : left.label.localeCompare(right.label),
    );
}
