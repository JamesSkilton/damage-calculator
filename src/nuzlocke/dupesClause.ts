import { EVOLUTION_FAMILIES } from './evolutionFamilies';
import type { EncounterRates, RunEncounter } from './types';

const familyByName = new Map<string, string>();
for (const family of EVOLUTION_FAMILIES)
  for (const name of family) familyByName.set(name, family[0]);

export function familyOf(species: string): string {
  return familyByName.get(species) ?? species;
}

// Evolution families already used by a caught or dead Pokémon on another route.
export function claimedFamilies(
  encounters: readonly RunEncounter[],
  exceptId: string,
): Set<string> {
  const claimed = new Set<string>();
  for (const encounter of encounters) {
    if (
      encounter.id !== exceptId &&
      encounter.species &&
      (encounter.status === 'caught' || encounter.status === 'dead')
    )
      claimed.add(familyOf(encounter.species));
  }
  return claimed;
}

// Rescales the rates of the species that are still allowed so they keep the same total
// as the original table. Untouched when nothing on this route is blocked.
export function adjustRates(
  species: readonly string[],
  rates: EncounterRates,
  claimed: ReadonlySet<string>,
): EncounterRates {
  let total = 0;
  let available = 0;
  for (const name of species) {
    const rate = rates[name] ?? 0;
    total += rate;
    if (!claimed.has(familyOf(name))) available += rate;
  }
  const adjusted: EncounterRates = {};
  for (const name of species) {
    const rate = rates[name];
    if (!rate || claimed.has(familyOf(name))) continue;
    adjusted[name] = available > 0 ? (rate * total) / available : rate;
  }
  return adjusted;
}
