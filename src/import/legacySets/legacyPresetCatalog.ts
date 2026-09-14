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

export interface PokemonPreset extends ImportedPokemonSet {
  buildName: string;
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

export function normalizeLegacyPreset(
  generation: BattleGeneration,
  species: string,
  buildName: string,
  build: LegacyPresetBuild,
): PokemonPreset {
  const nature = build.nature && natureNames.has(build.nature)
    ? build.nature
    : 'Serious';
  return {
    id: `legacy-gen${generation}-${species}-${buildName}`,
    generation,
    species,
    buildName,
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
  const source = legacyPresetData.find(
    (entry) => entry.generation === generation,
  );
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
        normalizeLegacyPreset(generation, species, buildName, build),
      ),
    )
    .sort((left, right) =>
      left.species.localeCompare(right.species) ||
      left.buildName.localeCompare(right.buildName),
    );
}