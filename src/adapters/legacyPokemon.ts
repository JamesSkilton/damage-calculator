import type {
  BattleCombatant,
  BattleGender,
  BattleGeneration,
  BattleStatId,
  BattleStats,
  BattleStatusName,
  BattleTypeName,
} from 'domain/index';
import {
  mergeLegacy,
  toLegacyId,
  type LegacyGeneration,
} from 'adapters/legacyShared';

type LegacyPartialStats = Partial<Record<BattleStatId, number>> & {
  spc?: number;
};

export interface LegacySpeciesData {
  id?: string;
  name: string;
  types: readonly [BattleTypeName] | readonly [BattleTypeName, BattleTypeName];
  weightkg: number;
  gender?: BattleGender;
  abilities?: Readonly<{ 0?: string }>;
  baseStats?: Readonly<Record<BattleStatId, number>>;
  baseSpecies?: string;
  otherFormes?: readonly string[];
}

export interface LegacyPokemonInput {
  name: string;
  level?: number;
  ability?: string;
  abilityOn?: boolean;
  isDynamaxed?: boolean;
  dynamaxLevel?: number;
  /** Reserved for later adapter phases; preserved in the legacy input shape. */
  alliesFainted?: number;
  /** Reserved for later adapter phases; preserved in the legacy input shape. */
  boostedStat?: Exclude<BattleStatId, 'hp'> | 'auto';
  item?: string;
  gender?: BattleGender;
  nature?: string;
  ivs?: LegacyPartialStats;
  evs?: LegacyPartialStats;
  boosts?: LegacyPartialStats;
  originalCurHP?: number;
  currentHp?: number;
  status?: BattleStatusName | '';
  teraType?: BattleTypeName;
  toxicCounter?: number;
  moves?: readonly string[];
  overrides?: Partial<LegacySpeciesData>;
}

function defaultStats(value: number): BattleStats {
  return {
    hp: value,
    atk: value,
    def: value,
    spa: value,
    spd: value,
    spe: value,
  };
}

function mapStats(
  generation: BattleGeneration,
  current: LegacyPartialStats | undefined,
  defaultValue: number,
  enforceSpecialMatch: boolean,
): BattleStats {
  const mapped = defaultStats(defaultValue);

  if (!current) {
    return mapped;
  }

  const withoutSpc = { ...current } as Record<string, number | undefined>;

  if (current.spc !== undefined) {
    withoutSpc.spa = current.spc;
    withoutSpc.spd = current.spc;
  }

  if (
    enforceSpecialMatch &&
    generation > 0 &&
    generation <= 2 &&
    withoutSpc.spa !== withoutSpc.spd
  ) {
    throw new Error(
      'Special Attack and Special Defense must match in Gen 1 and Gen 2',
    );
  }

  delete withoutSpc.spc;

  return {
    ...mapped,
    ...withoutSpc,
  } as BattleStats;
}

function getSpeciesData(
  generation: LegacyGeneration<LegacySpeciesData, unknown>,
  input: LegacyPokemonInput,
): LegacySpeciesData {
  const species = generation.species.get(toLegacyId(input.name));

  if (!species) {
    throw new Error(`Unknown species: ${input.name}`);
  }

  return mergeLegacy(species, input.overrides);
}

export function mapLegacyPokemonToBattleCombatant(
  generation: LegacyGeneration<LegacySpeciesData, unknown>,
  input: LegacyPokemonInput,
): BattleCombatant {
  const species = getSpeciesData(generation, input);

  return {
    generation: generation.num,
    name: input.name,
    species: species.name,
    level: generation.num === 0 ? 50 : input.level || 100,
    gender: input.gender || species.gender || 'M',
    ability: input.ability || species.abilities?.[0] || undefined,
    item: input.item,
    nature: input.nature || 'Serious',
    types: species.types,
    ivs: mapStats(generation.num, input.ivs, 31, true),
    evs: mapStats(
      generation.num,
      input.evs,
      generation.num === 0 || generation.num >= 3 ? 0 : 252,
      true,
    ),
    boosts: mapStats(generation.num, input.boosts, 0, true),
    currentHp: input.currentHp ?? input.originalCurHP ?? 0,
    status: input.status || undefined,
    toxicCounter: input.toxicCounter || 0,
    abilityOn: !!input.abilityOn,
    isDynamaxed: !!input.isDynamaxed,
    dynamaxLevel: input.isDynamaxed
      ? input.dynamaxLevel === undefined
        ? 10
        : input.dynamaxLevel
      : undefined,
    moves: [...(input.moves || [])],
    teratype: input.teraType,
  };
}

export type { LegacyPartialStats };
