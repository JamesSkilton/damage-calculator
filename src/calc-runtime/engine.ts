import type {BattleCombatant, BattleField, BattleMove} from 'domain/index';
import {calculate as calculateCore} from './core/calc';
import {Generations} from './core/data';
import {Field as CoreField} from './core/field';
import {Move as CoreMove} from './core/move';
import {Pokemon as CorePokemon} from './core/pokemon';
import type {Result as CoreResult} from './core/result';
import {toID} from './core/util';
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
    teraType: pokemon.teratype,
    toxicCounter: pokemon.toxicCounter,
    moves: pokemon.moves as CoreData.MoveName[],
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
