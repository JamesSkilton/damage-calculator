import type { BattleGeneration } from 'domain/index';
import { Generations } from 'calc-runtime/core/data/index';
import type { MoveOption } from './moveOptions';
import { getMovesForGeneration } from './moveOptions';

const NO_MOVE_NAME = '(No Move)';

/**
 * Build the full MoveOption catalog for a generation from the typed core
 * move data, excluding the legacy '(No Move)' placeholder entry.
 */
export function buildMoveCatalog(generation: BattleGeneration): MoveOption[] {
  const moves: MoveOption[] = [];

  for (const move of Generations.get(generation).moves) {
    if (move.name === NO_MOVE_NAME) {
      continue;
    }

    moves.push({
      name: move.name,
      type: move.type,
      basePower: move.basePower,
      category: move.category ?? 'Status',
    });
  }

  return getMovesForGeneration(moves);
}
