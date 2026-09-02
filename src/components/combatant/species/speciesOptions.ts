/**
 * Species option for UI selection (name and basic metadata).
 * Used to populate the Pokémon dropdown in CombatantIdentityFields.
 */
export interface SpeciesOption {
  name: string;
  types: string[];
}

/**
 * Get available species for a generation, sorted alphabetically.
 */
export function getSpeciesForGeneration(
  species: SpeciesOption[],
): SpeciesOption[] {
  return species.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Filter species options by search term (case-insensitive, substring match).
 */
export function filterSpeciesOptions(
  options: SpeciesOption[],
  searchTerm: string,
): SpeciesOption[] {
  if (!searchTerm.trim()) {
    return options;
  }

  const lowerSearch = searchTerm.toLowerCase();
  return options.filter((species) =>
    species.name.toLowerCase().includes(lowerSearch),
  );
}
