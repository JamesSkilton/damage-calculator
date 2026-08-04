/**
 * Move option for UI selection (name and basic metadata).
 */
export interface MoveOption {
  name: string;
  type: string;
  basePower: number;
  category: string;
}

/**
 * Get available moves for a generation, sorted alphabetically.
 * For now, accepts a pre-populated array of move options.
 * Future: will source from legacy generation data.
 */
export function getMovesForGeneration(moves: MoveOption[]): MoveOption[] {
  // Sort alphabetically
  return moves.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Filter move options by search term (case-insensitive, substring match).
 */
export function filterMoveOptions(
  options: MoveOption[],
  searchTerm: string,
): MoveOption[] {
  if (!searchTerm.trim()) {
    return options;
  }

  const lowerSearch = searchTerm.toLowerCase();
  return options.filter((move) =>
    move.name.toLowerCase().includes(lowerSearch),
  );
}

/**
 * Resolve a move name against available options, returning the best match or undefined.
 * This helps handle user input normalization.
 */
export function resolveMoveOption(
  moveName: string,
  options: MoveOption[],
): MoveOption | undefined {
  const trimmed = moveName.trim();
  if (!trimmed) {
    return undefined;
  }

  // Exact match (case-insensitive)
  const exactMatch = options.find(
    (opt) => opt.name.toLowerCase() === trimmed.toLowerCase(),
  );
  if (exactMatch) {
    return exactMatch;
  }

  // Partial match (case-insensitive, starts with)
  const partialMatch = options.find((opt) =>
    opt.name.toLowerCase().startsWith(trimmed.toLowerCase()),
  );
  if (partialMatch) {
    return partialMatch;
  }

  // No match found
  return undefined;
}

/**
 * Check if a move name is valid/available in the generation.
 */
export function isMoveAvailable(
  moveName: string,
  options: MoveOption[],
): boolean {
  return resolveMoveOption(moveName, options) !== undefined;
}
