import type { BattleGeneration } from 'domain/index';
import { Generations } from 'calc-runtime/core/data/index';
import type { SpeciesOption } from './speciesOptions';
import { getSpeciesForGeneration } from './speciesOptions';

export function buildSpeciesCatalog(
  generation: BattleGeneration,
): SpeciesOption[] {
  const species: SpeciesOption[] = [];

  for (const specie of Generations.get(generation).species) {
    species.push({ name: specie.name, types: [...specie.types] });
  }

  return getSpeciesForGeneration(species);
}
