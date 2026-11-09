import type { BattleGeneration, BattleStatusName } from 'domain/shared';

/** Moves that always inflict a major status when they hit. Accuracy and abilities are not modelled. */
const INFLICTED_STATUS: Record<string, BattleStatusName> = {
  'Thunder Wave': 'par',
  'Stun Spore': 'par',
  Glare: 'par',
  Nuzzle: 'par',
  'Zap Cannon': 'par',
  Hypnosis: 'slp',
  'Sleep Powder': 'slp',
  Spore: 'slp',
  'Lovely Kiss': 'slp',
  Sing: 'slp',
  'Grass Whistle': 'slp',
  'Dark Void': 'slp',
  'Will-O-Wisp': 'brn',
  Toxic: 'tox',
  'Poison Powder': 'psn',
  'Poison Gas': 'psn',
  'Toxic Thread': 'psn',
};

const POWDER_MOVES = new Set(['Stun Spore', 'Sleep Powder', 'Spore', 'Poison Powder']);

/** Status moves that always confuse their target when they hit. Accuracy is not modelled. */
const CONFUSING_MOVES = new Set(['Confuse Ray', 'Supersonic', 'Swagger', 'Flatter', 'Sweet Kiss', 'Teeter Dance']);

export function inflictsConfusion(moveName: string, targetAbility: string | undefined): boolean {
  return CONFUSING_MOVES.has(moveName) && targetAbility !== 'Own Tempo';
}

/**
 * The status a move would leave on a target with the given types and current status,
 * or undefined when the move doesn't inflict one or the target can't take it.
 */
export function getInflictedStatus(
  generation: BattleGeneration,
  moveName: string,
  targetTypes: readonly string[],
  targetStatus: BattleStatusName | undefined,
): BattleStatusName | undefined {
  const status = INFLICTED_STATUS[moveName];
  if (!status || targetStatus) return undefined;

  const isType = (type: string) => targetTypes.includes(type);
  if (status === 'par') {
    if (moveName === 'Thunder Wave' && isType('Ground')) return undefined;
    if (generation >= 6 && isType('Electric')) return undefined;
  }
  if (status === 'brn' && isType('Fire')) return undefined;
  if ((status === 'psn' || status === 'tox') && (isType('Poison') || isType('Steel'))) return undefined;
  if (generation >= 6 && POWDER_MOVES.has(moveName) && isType('Grass')) return undefined;
  return status;
}
