import type { BattleGeneration, BattleMove } from '@/domain';
import { toLegacyId, type LegacyGeneration } from '@/adapters/legacyShared';
import { SPECIAL_TYPES } from '@/adapters/legacyMove.constants';
import { getMoveData, resolveMoveData } from '@/adapters/legacyMove.resolve';
import type {
  LegacyMoveData,
  LegacyMoveInput,
} from '@/adapters/legacyMove.types';

function inferMoveCategory(
  generation: BattleGeneration,
  data: LegacyMoveData,
): BattleMove['category'] {
  if (data.category) {
    return data.category;
  }

  return generation > 0 && generation < 4
    ? SPECIAL_TYPES.includes(data.type)
      ? 'Special'
      : 'Physical'
    : 'Status';
}

function getMoveHits(data: LegacyMoveData, input: LegacyMoveInput): number {
  if (!data.multihit) {
    return input.hits || 1;
  }

  if (data.multiaccuracy && typeof data.multihit === 'number') {
    return input.hits || data.multihit;
  }

  if (typeof data.multihit === 'number') {
    return data.multihit;
  }

  if (input.hits) {
    return input.hits;
  }

  return input.ability === 'Skill Link'
    ? data.multihit[1]
    : data.multihit[0] + 1;
}

export function mapLegacyMoveToBattleMove(
  generation: LegacyGeneration<unknown, LegacyMoveData>,
  input: LegacyMoveInput,
): BattleMove {
  const baseData = getMoveData(generation, input);
  const data = resolveMoveData(generation, input, baseData);
  const moveId = toLegacyId(data.name || baseData.name);
  const typelessDamage =
    ((generation.num === 0 || generation.num >= 2) && moveId === 'struggle') ||
    (generation.num > 0 &&
      generation.num <= 4 &&
      ['futuresight', 'doomdesire'].includes(moveId));
  const moveType = typelessDamage ? '???' : data.type;

  const basePower =
    data.basePower ||
    (['return', 'frustration', 'pikapapow', 'veeveevolley'].includes(moveId)
      ? 102
      : 0);

  return {
    generation: generation.num,
    name: data.name,
    basePower,
    type: moveType,
    category: inferMoveCategory(generation.num, data),
    flags: { ...data.flags },
    target: data.target || 'any',
    recoil: data.recoil,
    drain: data.drain,
    priority: data.priority || 0,
    hits: getMoveHits(data, input),
    isCrit:
      !!input.isCrit ||
      !!data.willCrit ||
      (generation.num === 1 &&
        ['crabhammer', 'razorleaf', 'slash', 'karatechop'].includes(moveId)),
    isZ: !!data.isZ,
    isMax: !!data.isMax,
    isStellarFirstUse: !!input.isStellarFirstUse,
    timesUsed: input.timesUsed || 1,
    timesUsedWithMetronome: input.timesUsedWithMetronome,
    hasCrashDamage: !!data.hasCrashDamage,
    mindBlownRecoil: !!data.mindBlownRecoil,
    struggleRecoil: !!data.struggleRecoil,
    breaksProtect: !!data.breaksProtect,
    ignoreDefensive: !!data.ignoreDefensive,
    multiaccuracy: !!data.multiaccuracy,
    overrideOffensiveStat: data.overrideOffensiveStat,
    overrideDefensiveStat: data.overrideDefensiveStat,
    overrideOffensivePokemon: data.overrideOffensivePokemon,
    overrideDefensivePokemon: data.overrideDefensivePokemon,
    secondaries: data.secondaries,
    self: data.self,
  };
}

export type {
  LegacyMoveData,
  LegacyMoveInput,
} from '@/adapters/legacyMove.types';
