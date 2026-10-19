import type {
  BattleCombatant,
  BattleField,
  BattleGeneration,
} from 'domain/index';
import { calculateBattleSpeed } from 'calc-runtime';
import {
  buildBattleCalcBreakdowns,
  type BattleCalcMoveInput,
} from './battleCalc';

export type SpeedRelation = 'faster' | 'tie' | 'slower';
export type MatchupTier = 'excellent' | 'good' | 'neutral' | 'poor' | 'unknown';

export interface MatchupSettings {
  /** Hits a candidate must survive to earn the "survives" badge and a good tier. */
  surviveHits: number;
  /** Hits survived that, together with comboKoHits, make a candidate excellent. */
  comboSurviveHits: number;
  /** Hits needed to KO that, with comboSurviveHits, make a candidate excellent. */
  comboKoHits: number;
}

export const DEFAULT_MATCHUP_SETTINGS: MatchupSettings = {
  surviveHits: 4,
  comboSurviveHits: 2,
  comboKoHits: 2,
};

export interface MatchupTarget {
  generation: BattleGeneration;
  defender: BattleCombatant;
  defenderMoves: readonly BattleCalcMoveInput[];
  field: BattleField;
}

export interface MatchupCandidate {
  combatant: BattleCombatant;
  moves: readonly BattleCalcMoveInput[];
}

export interface BoxMatchup {
  speed: SpeedRelation;
  candidateSpeed: number;
  targetSpeed: number;
  /** Fewest hits that guarantee a KO with the candidate's best move; undefined when it deals no damage. */
  hitsToKo?: number;
  bestMove?: string;
  /** Hits the candidate is guaranteed to survive from the target's strongest move; undefined with no target moves. */
  survivesHits?: number;
  threatMove?: string;
  tier: MatchupTier;
}

export function getSpeedRelation(
  candidateSpeed: number,
  targetSpeed: number,
): SpeedRelation {
  if (candidateSpeed > targetSpeed) return 'faster';
  return candidateSpeed === targetSpeed ? 'tie' : 'slower';
}

export function classifyMatchup(
  matchup: Pick<BoxMatchup, 'speed' | 'hitsToKo' | 'survivesHits'>,
  settings: MatchupSettings,
): MatchupTier {
  const { speed, hitsToKo, survivesHits } = matchup;
  const kos = (hits: number) => hitsToKo !== undefined && hitsToKo <= hits;
  const survives = (hits: number) =>
    survivesHits !== undefined && survivesHits >= hits;

  if (
    (speed === 'faster' && kos(1)) ||
    (survives(settings.comboSurviveHits) && kos(settings.comboKoHits))
  ) {
    return 'excellent';
  }
  if (
    survives(settings.surviveHits) ||
    (speed === 'faster' && kos(settings.comboKoHits))
  ) {
    return 'good';
  }
  if (survivesHits === 0 && (speed !== 'faster' || !kos(1))) {
    return 'poor';
  }
  return 'neutral';
}

export function evaluateBoxMatchup(
  target: MatchupTarget,
  candidate: MatchupCandidate,
  settings: MatchupSettings,
): BoxMatchup | undefined {
  try {
    const { generation, defender, field } = target;
    const candidateSpeed = calculateBattleSpeed({
      generation,
      combatant: candidate.combatant,
      field,
      side: 'attacker',
    });
    const targetSpeed = calculateBattleSpeed({
      generation,
      combatant: defender,
      field,
      side: 'defender',
    });

    let hitsToKo: number | undefined;
    let bestMove: string | undefined;
    for (const breakdown of buildBattleCalcBreakdowns({
      generation,
      attacker: candidate.combatant,
      defender,
      field,
      moves: candidate.moves,
    })) {
      const details = breakdown.details;
      const minRoll = details?.possibleDamage[0] ?? 0;
      if (!details || minRoll <= 0) continue;
      const hits = Math.ceil(details.defenderCurrentHp / minRoll);
      if (hitsToKo === undefined || hits < hitsToKo) {
        hitsToKo = hits;
        bestMove = breakdown.label;
      }
    }

    let survivesHits: number | undefined;
    let threatMove: string | undefined;
    for (const breakdown of buildBattleCalcBreakdowns({
      generation,
      attacker: defender,
      defender: candidate.combatant,
      field,
      moves: target.defenderMoves,
    })) {
      const details = breakdown.details;
      const maxRoll = details?.possibleDamage.at(-1) ?? 0;
      if (!details || maxRoll <= 0) continue;
      const survives = Math.ceil(details.defenderCurrentHp / maxRoll) - 1;
      if (survivesHits === undefined || survives < survivesHits) {
        survivesHits = survives;
        threatMove = breakdown.label;
      }
    }

    const speed = getSpeedRelation(candidateSpeed, targetSpeed);
    return {
      speed,
      candidateSpeed,
      targetSpeed,
      hitsToKo,
      bestMove,
      survivesHits,
      threatMove,
      tier: classifyMatchup({ speed, hitsToKo, survivesHits }, settings),
    };
  } catch {
    return undefined;
  }
}

export function describeMatchupBadges(
  matchup: BoxMatchup,
  settings: MatchupSettings,
): string[] {
  const badges: string[] = [];
  if (matchup.hitsToKo !== undefined && matchup.hitsToKo <= 4) {
    badges.push(matchup.hitsToKo === 1 ? 'OHKO' : `${matchup.hitsToKo}HKO`);
  }
  if (matchup.survivesHits !== undefined) {
    if (matchup.survivesHits === 0) badges.push('Dies 1 hit');
    else if (matchup.survivesHits >= settings.surviveHits)
      badges.push(`Lives ${settings.surviveHits}+`);
    else badges.push(`Lives ${matchup.survivesHits}`);
  }
  return badges;
}
