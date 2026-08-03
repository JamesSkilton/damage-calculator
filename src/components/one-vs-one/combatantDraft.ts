import type {
  BattleCombatant,
  BattleGeneration,
  BattleStatId,
  BattleStatusName,
  BattleTypeName,
} from 'domain/index';
import type { LegacyPokemonInput } from 'adapters/legacyPokemon';

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
    currentHp: 100,
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
  value: BattleCombatant[T],
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
    const parsed = Number(value);

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
    return {
      ...combatant,
      dynamaxLevel:
        value === undefined || value === null || value === ''
          ? undefined
          : Math.max(0, Math.min(10, Math.trunc(Number(value)))),
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
  value: number,
): BattleCombatant {
  return {
    ...combatant,
    [bucket]: {
      ...combatant[bucket],
      [statId]: value,
    },
  };
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
): LegacyPokemonInput {
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
    teraType: combatant.teratype,
    moves: combatant.moves.map((move) => move.trim()).filter(Boolean),
  };
}

export { statIds };
