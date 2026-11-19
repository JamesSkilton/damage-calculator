/**
 * Shared Run & Bun move and battle context types, plus post-KO switch ranking.
 */

export type AiMoveCategory = 'Physical' | 'Special' | 'Status';

export interface AiMove {
  name: string;
  category: AiMoveCategory;
  priority: number;
  /** Damage rolls against the player's active Pokémon; ignored for status moves. */
  damageRolls: readonly number[];
}

export interface RunAndBunAiContext {
  aiSpecies?: string;
  aiHp: number;
  aiMaxHp: number;
  aiSpeed: number;
  aiAbility?: string;
  aiItem?: string;
  aiStatus?: string;
  aiAttackStage?: number;
  playerHp: number;
  playerMaxHp: number;
  playerSpeed: number;
  playerAbility?: string;
  playerStatus?: string;
  /** Categories of the player's known moves. */
  playerMoveCategories: readonly AiMoveCategory[];
  /** Highest damage any player move can deal to the AI Pokémon. */
  playerMaxDamage: number;
  firstTurnOut: boolean;
  /** Berry consumption in the planned battle; omitted means no Berry eaten yet. */
  aiBerryEaten?: 'yes' | 'no' | 'maybe';
  moves: readonly AiMove[];
}

export function unusableDamageMove(
  move: AiMove,
  context: RunAndBunAiContext,
): boolean {
  return (
    (move.name === 'Belch' && context.aiBerryEaten !== 'yes') ||
    (move.name === 'Fake Out' && !context.firstTurnOut)
  );
}

export interface SwitchInCandidate {
  id: string;
  hp: number;
  faster: boolean;
  /** Highest damage this candidate can deal to the player's Pokémon. */
  maxDamageDealt: number;
  /** Highest damage the player's Pokémon can deal to this candidate. */
  maxDamageTaken: number;
  /** Its strongest move against the player's Pokémon. */
  bestMove?: { name: string; minDamage: number; killChance: number };
  /** The player's strongest move against this candidate. */
  bestTaken?: { name: string };
}

export interface RankedSwitchIn {
  id: string;
  reason: string;
}

/**
 * Orders the AI's remaining Pokémon for a post-KO switch-in, best first.
 * The doc doesn't spell out the post-KO routine, so this follows the usual
 * game logic: a faster mon that KOs, then a mon that survives a hit and KOs,
 * then any mon that survives, then the rest. Ties break on damage traded,
 * then party order.
 */
export function rankSwitchIns(
  candidates: readonly SwitchInCandidate[],
  playerHp: number,
): RankedSwitchIn[] {
  const tier = (candidate: SwitchInCandidate): number => {
    const kills = candidate.maxDamageDealt >= playerHp;
    const survives = candidate.maxDamageTaken < candidate.hp;
    if (kills && candidate.faster) return 0;
    if (kills && survives) return 1;
    return survives ? 2 : 3;
  };
  const trade = (candidate: SwitchInCandidate): number =>
    Math.min(candidate.maxDamageDealt / Math.max(playerHp, 1), 1) -
    Math.min(candidate.maxDamageTaken / Math.max(candidate.hp, 1), 1);
  const percent = (damage: number) =>
    Math.round((damage / Math.max(playerHp, 1)) * 100);
  const reason = (candidate: SwitchInCandidate): string => {
    const parts: string[] = [];
    const move = candidate.bestMove;
    if (move) {
      parts.push(
        `${move.name} does ${percent(move.minDamage)}-${percent(candidate.maxDamageDealt)}% to your Pokémon` +
          (move.killChance > 0
            ? ` (${Math.round(move.killChance * 100)}% to KO)`
            : ''),
      );
    }
    parts.push(candidate.faster ? 'it outspeeds you' : 'it is slower than you');
    const takenText = `${candidate.bestTaken?.name ?? 'your best hit'} does up to ${candidate.maxDamageTaken} of its ${candidate.hp} HP`;
    parts.push(
      candidate.maxDamageTaken < candidate.hp
        ? `it survives (${takenText})`
        : `it would not survive (${takenText})`,
    );
    return parts.join(', ');
  };

  return candidates
    .map((candidate, order) => ({ candidate, order }))
    .sort(
      (left, right) =>
        tier(left.candidate) - tier(right.candidate) ||
        trade(right.candidate) - trade(left.candidate) ||
        left.order - right.order,
    )
    .map(({ candidate }) => ({ id: candidate.id, reason: reason(candidate) }));
}
