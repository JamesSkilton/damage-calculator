import type {
  BattleGender,
  BattleGeneration,
  BattleStats,
  BattleTypeName,
} from 'domain/index';

export interface ImportedPokemonSet {
  id: string;
  generation: BattleGeneration;
  species: string;
  buildName?: string;
  trainerName?: string;
  // Fight order within a library; trainers are ordered by their first Pokémon's index.
  index?: number;
  sourcePresetId?: string;
  sourceLibraryId?: string;
  remote?: boolean;
  nickname?: string;
  level: number;
  gender?: BattleGender;
  ability?: string;
  item?: string;
  nature: string;
  teraType?: BattleTypeName;
  evs: BattleStats;
  ivs: BattleStats;
  moves: readonly string[];
}

export const SET_STAT_IDS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const;

export function emptyStats(value: number): BattleStats {
  return {
    hp: value,
    atk: value,
    def: value,
    spa: value,
    spd: value,
    spe: value,
  };
}