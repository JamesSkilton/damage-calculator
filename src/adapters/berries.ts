import type { BattleGeneration, BattleStatusName } from 'domain/shared';

export type BerryBoostStat = 'atk' | 'def' | 'spa' | 'spd' | 'spe';

export type HpBerryEffect =
  | { kind: 'heal'; amount: (maxHp: number) => number }
  | { kind: 'boost'; stat: BerryBoostStat; stages: number }
  /** Starf Berry: a random stat is sharply raised, so no single stat can be shown. */
  | { kind: 'random-boost' }
  /** Eaten with an effect the planner doesn't model (crit ratio, accuracy, priority). */
  | { kind: 'other' };

export interface HpBerry {
  /** Eaten once HP is at or below this fraction of max HP. */
  threshold: number;
  effect: HpBerryEffect;
}

const NO_BERRY_ABILITIES = new Set(['Klutz']);
const UNNERVE_ABILITIES = new Set(['Unnerve', 'As One (Glastrier)', 'As One (Spectrier)']);

export function canEatBerry(eaterAbility: string | undefined, opponentAbility: string | undefined): boolean {
  return !(eaterAbility && NO_BERRY_ABILITIES.has(eaterAbility)) &&
    !(opponentAbility && UNNERVE_ABILITIES.has(opponentAbility));
}

const PINCH_STATS: Record<string, BerryBoostStat> = {
  'Liechi Berry': 'atk',
  'Ganlon Berry': 'def',
  'Salac Berry': 'spe',
  'Petaya Berry': 'spa',
  'Apicot Berry': 'spd',
};

/** Berries eaten automatically when HP drops low enough. Gluttony widens the 1/4 threshold to 1/2. */
export function getHpBerry(
  item: string | undefined,
  generation: BattleGeneration,
  ability: string | undefined,
): HpBerry | undefined {
  if (!item) return undefined;
  const ripen = ability === 'Ripen' ? 2 : 1;
  const pinch = ability === 'Gluttony' ? 1 / 2 : 1 / 4;

  switch (item) {
    case 'Oran Berry':
      return { threshold: 1 / 2, effect: { kind: 'heal', amount: () => 10 * ripen } };
    case 'Sitrus Berry':
      return { threshold: 1 / 2, effect: { kind: 'heal', amount: (maxHp) => Math.floor(maxHp / 4) * ripen } };
    case 'Figy Berry':
    case 'Wiki Berry':
    case 'Mago Berry':
    case 'Aguav Berry':
    case 'Iapapa Berry': {
      const divisor = generation >= 7 ? 3 : 8;
      return { threshold: pinch, effect: { kind: 'heal', amount: (maxHp) => Math.floor(maxHp / divisor) * ripen } };
    }
    case 'Starf Berry':
      return { threshold: pinch, effect: { kind: 'random-boost' } };
    case 'Lansat Berry':
    case 'Micle Berry':
    case 'Custap Berry':
      return { threshold: pinch, effect: { kind: 'other' } };
    default: {
      const stat = PINCH_STATS[item];
      return stat ? { threshold: pinch, effect: { kind: 'boost', stat, stages: ripen } } : undefined;
    }
  }
}

export type HitBerryEffect =
  | { kind: 'boost'; stat: BerryBoostStat; stages: number }
  /** The attacker loses a fraction of its own max HP. */
  | { kind: 'recoil'; divisor: number }
  | { kind: 'heal'; divisor: number };

export interface HitBerry {
  when: 'physical' | 'special' | 'super-effective';
  effect: HitBerryEffect;
}

/** Berries that trigger when their holder survives a hit. */
export function getHitBerry(item: string | undefined, ability: string | undefined): HitBerry | undefined {
  const ripen = ability === 'Ripen' ? 2 : 1;
  switch (item) {
    case 'Kee Berry':
      return { when: 'physical', effect: { kind: 'boost', stat: 'def', stages: ripen } };
    case 'Maranga Berry':
      return { when: 'special', effect: { kind: 'boost', stat: 'spd', stages: ripen } };
    case 'Jaboca Berry':
      return { when: 'physical', effect: { kind: 'recoil', divisor: 8 / ripen } };
    case 'Rowap Berry':
      return { when: 'special', effect: { kind: 'recoil', divisor: 8 / ripen } };
    case 'Enigma Berry':
      return { when: 'super-effective', effect: { kind: 'heal', divisor: 4 / ripen } };
    default:
      return undefined;
  }
}

/** Berries that cure a major status as soon as it is inflicted. */
export function curesStatus(item: string | undefined, status: BattleStatusName): boolean {
  switch (item) {
    case 'Lum Berry':
      return true;
    case 'Cheri Berry':
      return status === 'par';
    case 'Chesto Berry':
      return status === 'slp';
    case 'Pecha Berry':
      return status === 'psn' || status === 'tox';
    case 'Rawst Berry':
      return status === 'brn';
    case 'Aspear Berry':
      return status === 'frz';
    default:
      return false;
  }
}

/** Berries that cure confusion as soon as it is inflicted. */
export function curesConfusion(item: string | undefined): boolean {
  return item === 'Persim Berry' || item === 'Lum Berry';
}
