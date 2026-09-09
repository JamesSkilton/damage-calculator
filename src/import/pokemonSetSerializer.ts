import type { BattleCombatant } from 'domain/index';
import { formatStatLine } from './pokemonSetParser';

export function serializePokemonSet(combatant: BattleCombatant): string {
  const baseName = combatant.name && combatant.name !== combatant.species
    ? `${combatant.name} (${combatant.species})`
    : combatant.species;
  const gender = combatant.gender === 'M' || combatant.gender === 'F' ? ` (${combatant.gender})` : '';
  const lines = [`${baseName}${gender}`];
  if (combatant.item) lines[0] += ` @ ${combatant.item}`;
  if (combatant.ability) lines.push(`Ability: ${combatant.ability}`);
  if (combatant.level !== 100) lines.push(`Level: ${combatant.level}`);
  if (combatant.teratype) lines.push(`Tera Type: ${combatant.teratype}`);
  const evs = formatStatLine(combatant.evs, (value) => value > 0);
  if (evs) lines.push(`EVs: ${evs}`);
  if (combatant.nature) lines.push(`${combatant.nature} Nature`);
  const ivs = formatStatLine(combatant.ivs, (value) => value < 31);
  if (ivs) lines.push(`IVs: ${ivs}`);
  for (const move of combatant.moves) {
    if (move.trim()) lines.push(`- ${move.trim()}`);
  }
  return lines.join('\n');
}