import type {
  BattleGeneration,
  BattleStatId,
  BattleStats,
  BattleTypeName,
} from 'domain/index';
import type { ImportedPokemonSet } from '../pokemonSet';
import { SETDEX_RBY } from './data/gen1';
import { SETDEX_GSC } from './data/gen2';
import { SETDEX_ADV } from './data/gen3';
import { SETDEX_DPP } from './data/gen4';
import { SETDEX_BW } from './data/gen5';
import { SETDEX_XY } from './data/gen6';
import { SETDEX_SM } from './data/gen7';
import { SETDEX_SS } from './data/gen8';
import { SETDEX_SV } from './data/gen9';
import { SETDEX_SV as SETDEX_RADICAL_RED } from '../romhacks/data/radicalRed.normal';
import { SETDEX_SV as SETDEX_RADICAL_RED_HARDCORE } from '../romhacks/data/radicalRed.hardcore';

export interface LegacyPresetBuild {
  level?: number;
  gender?: string;
  ability?: string;
  item?: string;
  nature?: string;
  teraType?: string;
  evs?: Record<string, number>;
  ivs?: Record<string, number>;
  moves?: string[];
}

export interface LegacyPresetSource {
  generation: BattleGeneration;
  sets: Record<string, Record<string, LegacyPresetBuild>>;
}

export type PresetLibraryId = 'standard' | 'radical-red' | 'radical-red-hardcore';

export interface PresetLibrary {
  id: PresetLibraryId;
  label: string;
  sources: LegacyPresetSource[];
}

export const legacyPresetData: LegacyPresetSource[] = [
  { generation: 1, sets: SETDEX_RBY },
  { generation: 2, sets: SETDEX_GSC },
  { generation: 3, sets: SETDEX_ADV },
  { generation: 4, sets: SETDEX_DPP },
  { generation: 5, sets: SETDEX_BW },
  { generation: 6, sets: SETDEX_XY },
  { generation: 7, sets: SETDEX_SM },
  { generation: 8, sets: SETDEX_SS },
  { generation: 9, sets: SETDEX_SV },
];

export const presetLibraries: PresetLibrary[] = [
  {
    id: 'standard',
    label: 'Standard',
    sources: legacyPresetData,
  },
  {
    id: 'radical-red',
    label: 'Radical Red',
    sources: [{ generation: 9, sets: SETDEX_RADICAL_RED }],
  },
  {
    id: 'radical-red-hardcore',
    label: 'Radical Red Hardcore',
    sources: [{ generation: 9, sets: SETDEX_RADICAL_RED_HARDCORE }],
  },
];

export interface PokemonPreset extends ImportedPokemonSet {
  buildName: string;
  trainerName?: string;
}

export interface PresetTrainerGroup {
  trainerName: string;
  presets: PokemonPreset[];
}

const statKeyMap: Record<string, BattleStatId> = {
  hp: 'hp',
  at: 'atk',
  atk: 'atk',
  df: 'def',
  def: 'def',
  sa: 'spa',
  spa: 'spa',
  sd: 'spd',
  spd: 'spd',
  sp: 'spe',
  spe: 'spe',
};

const natureNames = new Set([
  'Adamant', 'Bashful', 'Bold', 'Brave', 'Calm', 'Careful', 'Docile',
  'Gentle', 'Hardy', 'Hasty', 'Impish', 'Jolly', 'Lax', 'Lonely', 'Mild',
  'Modest', 'Naive', 'Naughty', 'Quiet', 'Quirky', 'Rash', 'Relaxed',
  'Sassy', 'Serious', 'Timid',
]);

const typeNames = new Set<BattleTypeName>([
  'Normal', 'Fighting', 'Flying', 'Poison', 'Ground', 'Rock', 'Bug', 'Ghost',
  'Steel', 'Fire', 'Water', 'Grass', 'Electric', 'Psychic', 'Ice', 'Dragon',
  'Dark', 'Fairy', 'Stellar', '???',
]);

function normalizeStats(
  values: Record<string, number> | undefined,
  defaultValue: number,
): BattleStats {
  const stats = {
    hp: defaultValue,
    atk: defaultValue,
    def: defaultValue,
    spa: defaultValue,
    spd: defaultValue,
    spe: defaultValue,
  };
  for (const [key, value] of Object.entries(values ?? {})) {
    const stat = statKeyMap[key.toLowerCase()];
    if (stat && Number.isFinite(value)) {
      stats[stat] = value;
    }
  }
  return stats;
}

function normalizeType(type: string | undefined): BattleTypeName | undefined {
  return typeNames.has(type as BattleTypeName) ? (type as BattleTypeName) : undefined;
}

export function extractPresetTrainerName(buildName: string): string {
  return buildName
    .replace(/^\*/, '')
    .replace(/\s+Set\s+\d+$/i, '')
    .trim();
}

export function normalizeLegacyPreset(
  generation: BattleGeneration,
  species: string,
  buildName: string,
  build: LegacyPresetBuild,
): PokemonPreset {
  return normalizePreset(generation, species, buildName, build);
}

function normalizePreset(
  generation: BattleGeneration,
  species: string,
  buildName: string,
  build: LegacyPresetBuild,
  libraryId: PresetLibraryId = 'standard',
): PokemonPreset {
  const nature = build.nature && natureNames.has(build.nature)
    ? build.nature
    : 'Serious';
  return {
    id: `${libraryId === 'standard' ? 'legacy' : libraryId}-gen${generation}-${species}-${buildName}`,
    generation,
    species,
    buildName,
    ...(libraryId !== 'standard'
      ? { trainerName: extractPresetTrainerName(buildName) }
      : {}),
    level: build.level ?? 100,
    gender: build.gender === 'M' || build.gender === 'F' || build.gender === 'N'
      ? build.gender
      : undefined,
    ability: build.ability,
    item: build.item,
    nature,
    teraType: normalizeType(build.teraType),
    evs: normalizeStats(build.evs, 0),
    ivs: normalizeStats(build.ivs, 31),
    moves: [...(build.moves ?? [])],
  };
}

export function getLegacyPokemonPresets(
  generation: BattleGeneration,
  availableSpecies?: readonly { name: string }[],
): PokemonPreset[] {
  return getPokemonPresets('standard', generation, availableSpecies);
}

export function getPokemonPresets(
  libraryId: PresetLibraryId,
  generation: BattleGeneration,
  availableSpecies?: readonly { name: string }[],
): PokemonPreset[] {
  const library = presetLibraries.find((entry) => entry.id === libraryId);
  const source = library?.sources.find((entry) => entry.generation === generation);
  if (!source) {
    return [];
  }

  const availableNames = availableSpecies
    ? new Set(availableSpecies.map((species) => species.name))
    : undefined;
  return Object.entries(source.sets)
    .filter(([species]) => !availableNames || availableNames.has(species))
    .flatMap(([species, builds]) =>
      Object.entries(builds).map(([buildName, build]) =>
        normalizePreset(generation, species, buildName, build, libraryId),
      ),
    )
    .sort((left, right) =>
      left.species.localeCompare(right.species) ||
      left.buildName.localeCompare(right.buildName),
    );
}

export function getPresetTrainerGroups(
  libraryId: PresetLibraryId,
  generation: BattleGeneration,
  availableSpecies?: readonly { name: string }[],
): PresetTrainerGroup[] {
  const groups = new Map<string, PokemonPreset[]>();
  for (const preset of getPokemonPresets(libraryId, generation, availableSpecies)) {
    if (!preset.trainerName) {
      continue;
    }
    const group = groups.get(preset.trainerName) ?? [];
    group.push(preset);
    groups.set(preset.trainerName, group);
  }

  return Array.from(groups, ([trainerName, presets]) => ({
    trainerName,
    presets,
  })).sort((left, right) => left.trainerName.localeCompare(right.trainerName));
}