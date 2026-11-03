import type {BattleCombatant, BattleField, BattleMove} from 'domain/index';
import {calculate as calculateCore} from './core/calc';
import {Generations} from './core/data';
import {Field as CoreField} from './core/field';
import {Move as CoreMove} from './core/move';
import {Pokemon as CorePokemon} from './core/pokemon';
import type {Result as CoreResult} from './core/result';
import {toID} from './core/util';
import {getFinalSpeed, isGrounded} from './core/mechanics/util';
import type {CalcRuntimeInput} from './contracts';
import {CalcRuntimeError} from './errors';
import type * as CoreData from './core/data/interface';

function getGeneration(generation: BattleCombatant['generation']) {
  const result = Generations.get(generation);
  if (!result) {
    throw new CalcRuntimeError(
      'UNKNOWN_GENERATION',
      `Generation ${generation} is not available in the calculation runtime.`,
    );
  }
  return result;
}

function createPokemon(
  generation: ReturnType<typeof getGeneration>,
  pokemon: BattleCombatant,
) {
  if (!generation.species.get(toID(pokemon.species))) {
    throw new CalcRuntimeError(
      'UNKNOWN_SPECIES',
      `Unknown species: ${pokemon.species}`,
    );
  }

  return CorePokemon(generation, pokemon.species as CoreData.SpeciesName, {
    name: pokemon.name as CoreData.SpeciesName,
    level: pokemon.level,
    ability: pokemon.ability as CoreData.AbilityName | undefined,
    abilityOn: pokemon.abilityOn,
    isDynamaxed: pokemon.isDynamaxed,
    dynamaxLevel: pokemon.dynamaxLevel,
    item: pokemon.item as CoreData.ItemName | undefined,
    gender: pokemon.gender,
    nature: pokemon.nature as CoreData.NatureName,
    ivs: pokemon.ivs,
    evs: pokemon.evs,
    boosts: pokemon.boosts,
    curHP: pokemon.currentHp,
    status: pokemon.status,
    teraType: pokemon.isTerastallized === false ? undefined : pokemon.teratype,
    toxicCounter: pokemon.toxicCounter,
    moves: pokemon.moves as CoreData.MoveName[],
    overrides: pokemon.baseStats ? { baseStats: { ...pokemon.baseStats } } : undefined,
  });
}

function createMove(
  generation: ReturnType<typeof getGeneration>,
  attacker: BattleCombatant,
  move: BattleMove,
) {
  if (!generation.moves.get(toID(move.name))) {
    throw new CalcRuntimeError('UNKNOWN_MOVE', `Unknown move: ${move.name}`);
  }

  return CoreMove(generation, move.name as CoreData.MoveName, {
    ability: attacker.ability as CoreData.AbilityName | undefined,
    item: attacker.item as CoreData.ItemName | undefined,
    species: attacker.species as CoreData.SpeciesName,
    useZ: move.isZ,
    useMax: move.isMax,
    isCrit: move.isCrit,
    isStellarFirstUse: move.isStellarFirstUse,
    hits: move.hits,
    timesUsed: move.timesUsed,
    timesUsedWithMetronome: move.timesUsedWithMetronome,
  });
}

function createField(field: BattleField) {
  return CoreField({
    gameType: field.gameType,
    weather: field.weather,
    terrain: field.terrain,
    isMagicRoom: field.isMagicRoom,
    isWonderRoom: field.isWonderRoom,
    isGravity: field.isGravity,
    isAuraBreak: field.isAuraBreak,
    isFairyAura: field.isFairyAura,
    isDarkAura: field.isDarkAura,
    isBeadsOfRuin: field.isBeadsOfRuin,
    isSwordOfRuin: field.isSwordOfRuin,
    isTabletsOfRuin: field.isTabletsOfRuin,
    isVesselOfRuin: field.isVesselOfRuin,
    attackerSide: field.attackerSide,
    defenderSide: field.defenderSide,
  });
}

export function calculateBattleRuntime({
  generation: generationNumber,
  attacker: attackerInput,
  defender: defenderInput,
  move: moveInput,
  field: fieldInput,
}: CalcRuntimeInput): CoreResult {
  const generation = getGeneration(generationNumber);
  const attacker = createPokemon(generation, attackerInput);
  const defender = createPokemon(generation, defenderInput);
  const move = createMove(generation, attackerInput, moveInput);
  const field = createField(fieldInput);

  return calculateCore(generation, attacker, defender, move, field);
}

/** Final in-battle speed for one combatant, including boosts, items, abilities, status and tailwind. */
export function calculateBattleSpeed({
  generation: generationNumber,
  combatant,
  field: fieldInput,
  side,
}: {
  generation: BattleCombatant['generation'];
  combatant: BattleCombatant;
  field: BattleField;
  side: 'attacker' | 'defender';
}): number {
  const generation = getGeneration(generationNumber);
  const pokemon = createPokemon(generation, combatant);
  const field = createField(fieldInput);
  return getFinalSpeed(
    generation,
    pokemon,
    field,
    side === 'attacker' ? field.attackerSide : field.defenderSide,
  );
}

export interface EndOfTurnResidual {
  maxHp: number;
  /** HP lost at end of turn; negative when the Pokémon heals. */
  damage: number;
  sources: string[];
  /** Per-source HP change; negative amounts are healing. */
  parts: { source: string; amount: number }[];
  /** Status a Flame Orb / Toxic Orb inflicts at the end of this turn; its damage starts next turn. */
  inflictedStatus?: 'brn' | 'tox';
}

/**
 * End-of-turn residual HP change for one combatant: status, weather, terrain,
 * and held-item / ability effects. `toxicCounter` is the number of end-of-turn
 * ticks already taken while badly poisoned.
 */
export function calculateEndOfTurnResidual({
  generation: generationNumber,
  combatant,
  field: fieldInput,
  toxicCounter,
}: {
  generation: BattleCombatant['generation'];
  combatant: BattleCombatant;
  field: BattleField;
  toxicCounter: number;
}): EndOfTurnResidual {
  const generation = getGeneration(generationNumber);
  const pokemon = createPokemon(generation, combatant);
  const maxHp = pokemon.maxHP();
  const field = createField(fieldInput);
  const sources: string[] = [];
  const parts: EndOfTurnResidual['parts'] = [];
  let damage = 0;
  const fraction = (divisor: number, times = 1) => Math.max(1, Math.floor((maxHp * times) / divisor));
  const hurt = (amount: number, source: string) => {
    damage += amount;
    sources.push(source);
    parts.push({ source, amount });
  };
  const heal = (amount: number, source: string) => {
    damage -= amount;
    sources.push(source);
    parts.push({ source, amount: -amount });
  };

  const magicGuard = pokemon.hasAbility('Magic Guard');
  const itemActive = !pokemon.hasAbility('Klutz') && !field.isMagicRoom;
  const item = itemActive ? pokemon.item : undefined;
  const weather = field.weather;
  const isSun = weather === 'Sun' || weather === 'Harsh Sunshine';
  const isRain = weather === 'Rain' || weather === 'Heavy Rain';
  const sandImmune = pokemon.hasType('Rock', 'Ground', 'Steel') ||
    pokemon.hasAbility('Sand Veil', 'Sand Rush', 'Sand Force');
  const weatherProof = pokemon.hasAbility('Overcoat') || item === 'Safety Goggles';

  if (!magicGuard && !weatherProof) {
    if (weather === 'Sand' && !sandImmune) hurt(fraction(16), 'sandstorm');
    if (weather === 'Hail' && !pokemon.hasType('Ice') &&
        !pokemon.hasAbility('Snow Cloak', 'Ice Body', 'Slush Rush')) {
      hurt(fraction(16), 'hail');
    }
  }
  if (isRain && pokemon.hasAbility('Rain Dish')) heal(fraction(16), 'Rain Dish');
  if (isRain && pokemon.hasAbility('Dry Skin')) heal(fraction(8), 'Dry Skin');
  if ((weather === 'Hail' || weather === 'Snow') && pokemon.hasAbility('Ice Body')) {
    heal(fraction(16), 'Ice Body');
  }
  if (!magicGuard && isSun && pokemon.hasAbility('Dry Skin')) hurt(fraction(8), 'Dry Skin');
  if (!magicGuard && isSun && pokemon.hasAbility('Solar Power')) hurt(fraction(8), 'Solar Power');

  if (field.terrain === 'Grassy' && isGrounded(pokemon, field)) heal(fraction(16), 'Grassy Terrain');

  if (item === 'Leftovers') heal(fraction(16), 'Leftovers');
  if (item === 'Black Sludge') {
    if (pokemon.hasType('Poison')) heal(fraction(16), 'Black Sludge');
    else if (!magicGuard) hurt(fraction(8), 'Black Sludge');
  }

  switch (combatant.status) {
    case 'brn':
      if (!magicGuard) {
        const divisor = generationNumber <= 6 ? 8 : 16;
        hurt(Math.max(1, Math.floor(fraction(divisor) / (pokemon.hasAbility('Heatproof') ? 2 : 1))), 'burn');
      }
      break;
    case 'psn':
      if (pokemon.hasAbility('Poison Heal')) heal(fraction(8), 'Poison Heal');
      else if (!magicGuard) hurt(fraction(8), 'poison');
      break;
    case 'tox':
      if (pokemon.hasAbility('Poison Heal')) heal(fraction(8), 'Poison Heal');
      else if (!magicGuard) hurt(fraction(16, Math.min(15, toxicCounter + 1)), 'toxic');
      break;
    default:
      break;
  }

  if (item === 'Sticky Barb' && !magicGuard) hurt(fraction(8), 'Sticky Barb');

  let inflictedStatus: EndOfTurnResidual['inflictedStatus'];
  if (!combatant.status) {
    if (item === 'Flame Orb' && !pokemon.hasType('Fire') &&
        !pokemon.hasAbility('Water Veil', 'Water Bubble', 'Comatose', 'Purifying Salt')) {
      inflictedStatus = 'brn';
    } else if (item === 'Toxic Orb' && !pokemon.hasType('Poison', 'Steel') &&
        !pokemon.hasAbility('Immunity', 'Pastel Veil', 'Comatose', 'Purifying Salt')) {
      inflictedStatus = 'tox';
    }
    if (inflictedStatus) sources.push(item === 'Flame Orb' ? 'Flame Orb (burns)' : 'Toxic Orb (poisons)');
  }

  return {maxHp, damage, sources, parts, inflictedStatus};
}
