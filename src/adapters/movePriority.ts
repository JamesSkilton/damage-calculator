import type { BattleGeneration } from 'domain/shared';
import { Generations } from 'calc-runtime/core/data/index';

const priorityCache = new Map<BattleGeneration, Map<string, number>>();

/** Move name to base priority bracket for a generation. */
export function movePriorities(generation: BattleGeneration): Map<string, number> {
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

export function getMovePriority(generation: BattleGeneration, moveName: string): number {
  return movePriorities(generation).get(moveName) ?? 0;
}
