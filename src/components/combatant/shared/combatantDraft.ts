import type {
  BattleCombatant,
  BattleField,
  BattleGeneration,
  BattleStatId,
  BattleStatusName,
  BattleTypeName,
} from 'domain/index';
import type { LegacyPokemonInput } from 'adapters/legacyPokemon';
import type { LegacyMoveInput } from 'adapters/legacyMove.types';
import type { MoveDraft } from '../moves/moveDraft';
import { toMoveLegacyInput } from '../moves/moveDraft';

const statIds: readonly BattleStatId[] = [
  'hp',
  'atk',
  'def',
  'spa',
  'spd',
  'spe',
];

const attackerTypes: readonly [BattleTypeName] = ['Electric'];
const defenderTypes: readonly [BattleTypeName, BattleTypeName] = [
  'Grass',
  'Poison',
];

const baseMoves = ['', '', '', ''] as const;

export type TeamDraft = {
  attacker: BattleCombatant;
  defender: BattleCombatant;
};

export interface LegacyBattlePayloadSide {
  pokemon: LegacyPokemonInput;
  moves: readonly LegacyMoveInput[];
}

export interface LegacyBattlePayload {
  generation: BattleGeneration;
  field: BattleField;
  attacker: LegacyBattlePayloadSide;
  defender: LegacyBattlePayloadSide;
}

function createBaseCombatant(
  generation: BattleGeneration,
  role: 'attacker' | 'defender',
): BattleCombatant {
  return {
    generation,
    name: role === 'attacker' ? 'Attacker' : 'Defender',
    species: role === 'attacker' ? 'Pikachu' : 'Bulbasaur',
    level: 100,
    gender: role === 'attacker' ? 'M' : 'F',
    ability: role === 'attacker' ? 'Static' : 'Overgrow',
    item: role === 'attacker' ? 'Choice Band' : 'Eviolite',
    nature: role === 'attacker' ? 'Adamant' : 'Bold',
    shiny: false,
    isTerastallized: false,
    types: role === 'attacker' ? attackerTypes : defenderTypes,
    ivs: {
      hp: 31,
      atk: 31,
      def: 31,
      spa: 31,
      spd: 31,
      spe: 31,
    },
    evs: {
      hp: 0,
      atk: 0,
      def: 0,
      spa: 0,
      spd: 0,
      spe: 0,
    },
    boosts: {
      hp: 0,
      atk: 0,
      def: 0,
      spa: 0,
      spd: 0,
      spe: 0,
    },
    // 0 is a sentinel meaning "full HP" (see core/pokemon.ts originalCurHP),
    // matching the legacy calculator's default of a fully healthy defender.
    currentHp: 0,
    status: undefined,
    toxicCounter: 0,
    abilityOn: false,
    isDynamaxed: false,
    dynamaxLevel: undefined,
    moves: [...baseMoves],
    teratype: role === 'attacker' ? 'Electric' : 'Grass',
  };
}

export function createTeamDraft(generation: BattleGeneration): TeamDraft {
  return {
    attacker: createBaseCombatant(generation, 'attacker'),
    defender: createBaseCombatant(generation, 'defender'),
  } as const;
}

export function setTeamGeneration(
  team: TeamDraft,
  generation: BattleGeneration,
): TeamDraft {
  return {
    attacker: setCombatantField(team.attacker, 'generation', generation),
    defender: setCombatantField(team.defender, 'generation', generation),
  };
}

export function setCombatantField<T extends keyof BattleCombatant>(
  combatant: BattleCombatant,
  field: T,
  value: BattleCombatant[T] | string | number | null | undefined,
): BattleCombatant {
  if (field === 'name' || field === 'species' || field === 'nature') {
    return {
      ...combatant,
      [field]: String(value).trim(),
    };
  }

  if (
    field === 'ability' ||
    field === 'item' ||
    field === 'status' ||
    field === 'teratype'
  ) {
    const normalized = String(value).trim();

    return {
      ...combatant,
      [field]: normalized === '' ? undefined : normalized,
    };
  }

  if (field === 'level' || field === 'currentHp' || field === 'toxicCounter') {
    const rawValue = typeof value === 'string' ? value.trim() : value;

    if (rawValue === '') {
      return combatant;
    }

    const parsed = Number(rawValue);

    if (!Number.isFinite(parsed)) {
      return combatant;
    }

    return {
      ...combatant,
      [field]:
        field === 'level'
          ? Math.max(1, Math.min(100, Math.trunc(parsed)))
          : field === 'currentHp'
            ? Math.max(0, Math.trunc(parsed))
            : Math.max(0, Math.min(15, Math.trunc(parsed))),
    };
  }

  if (field === 'dynamaxLevel') {
    const rawValue = typeof value === 'string' ? value.trim() : value;

    if (rawValue === '') {
      return combatant;
    }

    const parsed = Number(rawValue);

    if (!Number.isFinite(parsed)) {
      return combatant;
    }

    return {
      ...combatant,
      dynamaxLevel: Math.max(0, Math.min(10, Math.trunc(parsed))),
    };
  }

  if (field === 'abilityOn' || field === 'isDynamaxed') {
    return {
      ...combatant,
      [field]: Boolean(value),
    };
  }

  return {
    ...combatant,
    [field]: value,
  };
}

export function setCombatantStat(
  combatant: BattleCombatant,
  bucket: 'ivs' | 'evs' | 'boosts',
  statId: BattleStatId,
  value: number | string | null | undefined,
): BattleCombatant {
  const rawValue = typeof value === 'string' ? value.trim() : value;

  if (rawValue === '') {
    return combatant;
  }

  const parsed = Number(rawValue);

  if (!Number.isFinite(parsed)) {
    return combatant;
  }

  const normalized = Math.trunc(parsed);
  if (bucket === 'evs') {
    if (normalized < 0 || normalized > 252) {
      return combatant;
    }
    const otherEvs = statIds
      .filter((id) => id !== statId)
      .reduce((sum, id) => sum + combatant.evs[id], 0);
    if (otherEvs + normalized > 510) {
      return combatant;
    }
  }

  return {
    ...combatant,
    [bucket]: {
      ...combatant[bucket],
      [statId]: normalized,
    },
  };
}

export function getEvValidationError(
  combatant: BattleCombatant,
  statId: BattleStatId,
  value: number | string | null | undefined,
): string | undefined {
  const rawValue = typeof value === 'string' ? value.trim() : value;
  if (rawValue === '' || rawValue === null || rawValue === undefined) {
    return undefined;
  }
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    return 'Enter a whole number.';
  }
  if (parsed < 0 || parsed > 252) {
    return 'Each stat allows 0–252 EVs.';
  }
  const otherEvs = statIds
    .filter((id) => id !== statId)
    .reduce((sum, id) => sum + combatant.evs[id], 0);
  return otherEvs + parsed > 510 ? 'EVs cannot exceed 510 total.' : undefined;
}

export function setCombatantMove(
  combatant: BattleCombatant,
  index: number,
  value: string,
): BattleCombatant {
  const moves = [...combatant.moves];
  moves[index] = value;

  return {
    ...combatant,
    moves,
  };
}

/**
 * Apply a species selection: sets `species`/`name` and, when the species is
 * found in `availableSpecies`, auto-syncs `types` to match it.
 */
export function setCombatantSpecies(
  combatant: BattleCombatant,
  speciesName: string,
  availableSpecies: readonly { name: string; types: readonly string[] }[],
): BattleCombatant {
  const withSpecies = setCombatantField(combatant, 'species', speciesName);
  const withName = setCombatantField(withSpecies, 'name', speciesName);

  const matchedSpecies = availableSpecies.find(
    (option) => option.name === speciesName,
  );
  if (!matchedSpecies) {
    return withName;
  }

  const [primaryType, secondaryType] = matchedSpecies.types as [
    BattleTypeName,
    BattleTypeName | undefined,
  ];
  return setCombatantTypes(withName, primaryType, secondaryType);
}

export function setCombatantTypes(
  combatant: BattleCombatant,
  primary: BattleTypeName,
  secondary?: BattleTypeName,
): BattleCombatant {
  return {
    ...combatant,
    types: secondary ? [primary, secondary] : [primary],
  };
}

export function setCombatantStatus(
  combatant: BattleCombatant,
  status: BattleStatusName | '',
): BattleCombatant {
  return {
    ...combatant,
    status: status === '' ? undefined : status,
  };
}

export function toLegacyPokemonInput(
  combatant: BattleCombatant,
  moveDrafts?: readonly MoveDraft[],
): LegacyPokemonInput {
  const moves = moveDrafts
    ? moveDrafts.map((move) => move.name.trim()).filter(Boolean)
    : combatant.moves.map((move) => move.trim()).filter(Boolean);

  return {
    name: combatant.name,
    level: combatant.level,
    ability: combatant.ability || undefined,
    abilityOn: combatant.abilityOn,
    isDynamaxed: combatant.isDynamaxed,
    dynamaxLevel: combatant.dynamaxLevel,
    item: combatant.item || undefined,
    gender: combatant.gender,
    nature: combatant.nature,
    ivs: combatant.ivs,
    evs: combatant.evs,
    boosts: combatant.boosts,
    currentHp: combatant.currentHp,
    status: combatant.status ?? '',
    toxicCounter: combatant.toxicCounter,
    teraType: combatant.isTerastallized === false ? undefined : combatant.teratype,
    moves,
  };
}

export function toLegacyMoveInputs(
  moveDrafts: readonly MoveDraft[],
): readonly LegacyMoveInput[] {
  return moveDrafts
    .map(toMoveLegacyInput)
    .filter((move) => move.name.trim().length > 0);
}

export function toLegacyBattlePayload(
  generation: BattleGeneration,
  attacker: BattleCombatant,
  attackerMoves: readonly MoveDraft[],
  defender: BattleCombatant,
  defenderMoves: readonly MoveDraft[],
  field: BattleField,
): LegacyBattlePayload {
  return {
    generation,
    field,
    attacker: {
      pokemon: toLegacyPokemonInput(attacker, attackerMoves),
      moves: toLegacyMoveInputs(attackerMoves),
    },
    defender: {
      pokemon: toLegacyPokemonInput(defender, defenderMoves),
      moves: toLegacyMoveInputs(defenderMoves),
    },
  };
}

export { statIds };
