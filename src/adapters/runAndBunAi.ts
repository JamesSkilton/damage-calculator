import type {
  BattleCombatant,
  BattleField,
  BattleGeneration,
} from 'domain/index';
import { calculateBattleSpeed } from 'calc-runtime';
import { Generations } from 'calc-runtime/core/data/index';
import {
  predictRunAndBunAi,
  type AiMove,
  type AiMoveCategory,
  type AiMovePrediction,
  type RankedSwitchIn,
  type SwitchInCandidate,
  rankSwitchIns,
} from 'ai/runAndBunAi';
import { buildBattleCalcBreakdowns } from 'adapters/battleCalc';

export interface RunAndBunPredictionInput {
  generation: BattleGeneration;
  /** The opposing trainer's active Pokémon (the one choosing a move). */
  ai: BattleCombatant;
  /** The player's active Pokémon. */
  player: BattleCombatant;
  field: BattleField;
  aiHp: number;
  playerHp: number;
  aiMoves: readonly string[];
  playerMoves: readonly string[];
  firstTurnOut: boolean;
}

const priorityCache = new Map<BattleGeneration, Map<string, number>>();

function movePriorities(generation: BattleGeneration): Map<string, number> {
  let priorities = priorityCache.get(generation);
  if (!priorities) {
    priorities = new Map();
    for (const move of Generations.get(generation).moves) {
      priorities.set(move.name, move.priority ?? 0);
    }
    priorityCache.set(generation, priorities);
  }
  return priorities;
}

function moveCategories(
  generation: BattleGeneration,
): Map<string, AiMoveCategory> {
  const categories = new Map<string, AiMoveCategory>();
  for (const move of Generations.get(generation).moves) {
    categories.set(move.name, move.category ?? 'Status');
  }
  return categories;
}

const plainMove = (name: string) => ({
  name,
  isCrit: false,
  hits: 1,
  isStellarFirstUse: false,
  timesUsed: 1,
});

export interface RunAndBunSwitchInput {
  generation: BattleGeneration;
  player: BattleCombatant;
  playerHp: number;
  playerMoves: readonly string[];
  field: BattleField;
  candidates: readonly {
    id: string;
    combatant: BattleCombatant;
    moves: readonly string[];
  }[];
}

/** Roster ids of the AI's remaining Pokémon, in the order it would send them in after a KO. */
export function chooseAiSwitchIn(input: RunAndBunSwitchInput): RankedSwitchIn[] {
  const { generation, field } = input;
  const player = { ...input.player, currentHp: input.playerHp };
  const playerSpeed = calculateBattleSpeed({
    generation,
    combatant: player,
    field,
    side: 'attacker',
  });
  const maxDamage = (breakdowns: ReturnType<typeof buildBattleCalcBreakdowns>) =>
    Math.max(
      0,
      ...breakdowns.map((b) => b.details?.possibleDamage.at(-1) ?? 0),
    );
  const named = (moves: readonly string[]) =>
    moves.filter((name) => name.trim()).map(plainMove);

  try {
    const calculated = input.candidates.map((candidate) => ({
      candidate,
      dealt: buildBattleCalcBreakdowns({
        generation,
        attacker: candidate.combatant,
        defender: player,
        field,
        moves: named(candidate.moves),
      }),
    }));
    // A current HP of 0 is the placeholder for "full HP", which the calc reads that way too.
    const playerHp =
      input.playerHp > 0
        ? input.playerHp
        : calculated
            .flatMap(({ dealt }) => dealt)
            .find((b) => b.details)?.details?.defenderMaxHp ?? input.playerHp;

    const candidates: SwitchInCandidate[] = calculated.map(
      ({ candidate, dealt }) => {
        const taken = buildBattleCalcBreakdowns({
          generation,
          attacker: player,
          defender: candidate.combatant,
          field,
          moves: named(input.playerMoves),
        });
        const bestTaken = taken
          .map((b) => ({ b, max: b.details?.possibleDamage.at(-1) ?? 0 }))
          .sort((left, right) => right.max - left.max)[0];
        const candidateHp =
          candidate.combatant.currentHp > 0
            ? candidate.combatant.currentHp
            : bestTaken?.b.details?.defenderMaxHp ?? 0;
        const best = dealt
          .map((b) => ({ b, max: b.details?.possibleDamage.at(-1) ?? 0 }))
          .sort((left, right) => right.max - left.max)[0];
        const rolls = best?.b.details?.allDamageRolls ?? [];
        return {
          id: candidate.id,
          hp: candidateHp,
          faster:
            calculateBattleSpeed({
              generation,
              combatant: candidate.combatant,
              field,
              side: 'defender',
            }) >= playerSpeed,
          maxDamageDealt: maxDamage(dealt),
          maxDamageTaken: maxDamage(taken),
          bestTaken: bestTaken
            ? { name: named(input.playerMoves)[bestTaken.b.slotIndex]?.name }
            : undefined,
          bestMove:
            best && best.max > 0
              ? {
                  name: candidate.moves.filter((name) => name.trim())[best.b.slotIndex],
                  minDamage: best.b.details?.possibleDamage[0] ?? 0,
                  killChance:
                    rolls.length > 0
                      ? rolls.filter((roll) => roll >= playerHp).length / rolls.length
                      : 0,
                }
              : undefined,
        };
      },
    );
    return rankSwitchIns(candidates, playerHp);
  } catch {
    return input.candidates.map((candidate) => ({
      id: candidate.id,
      reason: 'party order (matchup could not be calculated)',
    }));
  }
}

/** Most likely AI moves for the current matchup, or an empty list when it can't be worked out. */
export function predictAiMoves(
  input: RunAndBunPredictionInput,
): AiMovePrediction[] {
  const aiMoves = input.aiMoves.filter((name) => name.trim());
  if (aiMoves.length === 0) return [];

  try {
    const { generation, field } = input;
    const priorities = movePriorities(generation);
    const categories = moveCategories(generation);
    const ai = { ...input.ai, currentHp: input.aiHp };
    const player = { ...input.player, currentHp: input.playerHp };

    const aiBreakdowns = new Map(
      buildBattleCalcBreakdowns({
        generation,
        attacker: ai,
        defender: player,
        field,
        moves: aiMoves.map(plainMove),
      }).map((breakdown) => [aiMoves[breakdown.slotIndex], breakdown]),
    );
    const playerBreakdowns = buildBattleCalcBreakdowns({
      generation,
      attacker: player,
      defender: ai,
      field,
      moves: input.playerMoves.filter((name) => name.trim()).map(plainMove),
    });

    const moves: AiMove[] = aiMoves.map((name) => ({
      name,
      category: categories.get(name) ?? 'Status',
      priority: priorities.get(name) ?? 0,
      damageRolls: aiBreakdowns.get(name)?.details?.allDamageRolls ?? [],
    }));

    const playerMoveCategories = input.playerMoves
      .map((name) => categories.get(name))
      .filter((category): category is AiMoveCategory => Boolean(category));
    const aiMaxHp = playerBreakdowns.find((b) => b.details)?.details
      ?.defenderMaxHp;
    const playerMaxHp = [...aiBreakdowns.values()].find((b) => b.details)
      ?.details?.defenderMaxHp;
    // A current HP of 0 is the placeholder for "full HP", which the calc reads that way too.
    const aiHp = input.aiHp > 0 ? input.aiHp : aiMaxHp ?? input.aiHp;
    const playerHp = input.playerHp > 0 ? input.playerHp : playerMaxHp ?? input.playerHp;

    return predictRunAndBunAi({
      aiSpecies: ai.species,
      aiHp,
      aiMaxHp: aiMaxHp ?? aiHp,
      aiSpeed: calculateBattleSpeed({
        generation,
        combatant: ai,
        field,
        side: 'defender',
      }),
      aiAbility: ai.ability,
      aiItem: ai.item,
      aiStatus: ai.status,
      aiAttackStage: ai.boosts.atk,
      playerHp,
      playerMaxHp: playerMaxHp ?? playerHp,
      playerSpeed: calculateBattleSpeed({
        generation,
        combatant: player,
        field,
        side: 'attacker',
      }),
      playerAbility: player.ability,
      playerStatus: player.status,
      playerMoveCategories,
      playerMaxDamage: Math.max(
        0,
        ...playerBreakdowns.map(
          (breakdown) => breakdown.details?.possibleDamage.at(-1) ?? 0,
        ),
      ),
      firstTurnOut: input.firstTurnOut,
      moves,
    });
  } catch {
    return [];
  }
}
