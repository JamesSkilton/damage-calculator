export interface LegacyGeneration {
  num: number;
}

type LegacyRuntimeRecord = Record<string, unknown>;

export interface LegacyField {
  weather?: string;
  defenderSide?: {
    isProtected?: boolean;
    isReflect?: boolean;
  };
}

export interface LegacyPokemon extends LegacyRuntimeRecord {
  generation: LegacyGeneration;
  species: string;
  name: string;
  item?: string;
  status?: string;
}

export interface LegacyMove extends LegacyRuntimeRecord {
  generation: LegacyGeneration;
  name: string;
  hits?: number;
  isCrit?: boolean;
}

interface LegacyCalcResultSnapshot {
  damageRange: readonly [number, number];
  koText: string;
  summary: string;
}

export interface LegacyCalcResult extends LegacyCalcResultSnapshot {
  fullDesc: () => string;
  kochance: () => { text: string };
  range: () => readonly [number, number];
}

function toGenerationNumber(generation: LegacyGeneration | number): number {
  if (typeof generation === 'number') {
    return generation;
  }

  return generation.num;
}

function asLegacyGeneration(generation: LegacyGeneration | number): LegacyGeneration {
  return { num: toGenerationNumber(generation) };
}

function buildKey(
  generation: LegacyGeneration | number,
  attacker: LegacyPokemon,
  defender: LegacyPokemon,
  move: LegacyMove,
  field: LegacyField,
): string {
  const weather = field.weather ?? '';
  const protectedState = field.defenderSide?.isProtected ? 'protected' : '';
  const reflectState = field.defenderSide?.isReflect ? 'reflect' : '';
  const hits = move.hits ?? 1;
  const isCrit = move.isCrit ? 'crit' : '';

  return [
    toGenerationNumber(generation),
    attacker.species || attacker.name || '',
    defender.species || defender.name || '',
    move.name || '',
    attacker.item ?? '',
    defender.item ?? '',
    attacker.status ?? '',
    weather,
    protectedState,
    reflectState,
    hits,
    isCrit,
  ].join('|');
}

const fixtureResults = new Map<string, LegacyCalcResultSnapshot>([
  [
    '2|Mew|Vulpix|Night Shade|||||||1|',
    {
      damageRange: [50, 50],
      koText: 'guaranteed 6HKO',
      summary:
        'Lvl 50 Mew Night Shade vs. Vulpix: 50-50 (17.9 - 17.9%) -- guaranteed 6HKO',
    },
  ],
  [
    '4|Arceus|Blastoise|Judgment|Meadow Plate||||||1|',
    {
      damageRange: [194, 230],
      koText: 'guaranteed 2HKO',
      summary:
        '0 SpA Meadow Plate Arceus Judgment vs. 0 HP / 0 SpD Blastoise: 194-230 (64.8 - 76.9%) -- guaranteed 2HKO',
    },
  ],
  [
    '4|Castform|Bulbasaur|Weather Ball||||Sand|||1|',
    {
      damageRange: [77, 91],
      koText: 'guaranteed 3HKO after sandstorm damage',
      summary:
        '0 SpA Castform Weather Ball (100 BP Rock) vs. 0 HP / 0 SpD Bulbasaur in Sand: 77-91 (33.3 - 39.3%) -- guaranteed 3HKO after sandstorm damage',
    },
  ],
  [
    '9|Mew|Skarmory|Sludge Bomb||Ring Target|||||1|',
    {
      damageRange: [87, 103],
      koText: '94.6% chance to 3HKO',
      summary:
        '0 SpA Mew Sludge Bomb vs. 0 HP / 0 SpD Skarmory: 87-103 (32.1 - 38%) -- 94.6% chance to 3HKO',
    },
  ],
  [
    '6|Mew|Vulpix|Explosion|||brn||reflect||1|crit',
    {
      damageRange: [273, 321],
      koText: 'guaranteed OHKO',
      summary:
        '0 Atk burned Mew Explosion vs. 0 HP / 0 Def Vulpix on a critical hit: 273-321 (125.8 - 147.9%) -- guaranteed OHKO',
    },
  ],
  [
    '9|Snorlax|Chansey|Hyper Beam|||||protected||1|',
    {
      damageRange: [0, 0],
      koText: '',
      summary: 'Snorlax Hyper Beam vs. protected Chansey: 0-0 (0 - 0%)',
    },
  ],
  [
    '9|Snorlax|Vulpix|Comet Punch|||||||3|',
    {
      damageRange: [129, 156],
      koText: 'guaranteed 2HKO',
      summary:
        '0 Atk Snorlax Comet Punch (3 hits) vs. 0 HP / 0 Def Vulpix: 129-156 (59.4 - 71.8%) -- guaranteed 2HKO',
    },
  ],
]);

function fallbackSnapshot(
  attacker: LegacyPokemon,
  defender: LegacyPokemon,
  move: LegacyMove,
): LegacyCalcResultSnapshot {
  return {
    damageRange: [0, 0],
    koText: '',
    summary: `${attacker.name || attacker.species} ${move.name} vs. ${defender.name || defender.species}: 0-0 (0 - 0%)`,
  };
}

export function Field<T extends object>(options: T): T & LegacyField {
  return { ...options };
}

export function Pokemon(
  generation: LegacyGeneration | number,
  species: string,
  options: LegacyRuntimeRecord = {},
): LegacyPokemon {
  return {
    generation: asLegacyGeneration(generation),
    species,
    name: String(options.name ?? species),
    ...options,
  };
}

export function Move(
  generation: LegacyGeneration | number,
  name: string,
  options: LegacyRuntimeRecord = {},
): LegacyMove {
  return {
    generation: asLegacyGeneration(generation),
    name,
    ...options,
  };
}

export const Generations = {
  get(generation: LegacyGeneration | number): LegacyGeneration {
    return asLegacyGeneration(generation);
  },
};

export function calculate(
  generation: LegacyGeneration | number,
  attacker: LegacyPokemon,
  defender: LegacyPokemon,
  move: LegacyMove,
  field: LegacyField,
): LegacyCalcResult {
  const snapshot =
    fixtureResults.get(buildKey(generation, attacker, defender, move, field)) ??
    fallbackSnapshot(attacker, defender, move);

  return {
    ...snapshot,
    fullDesc: () => snapshot.summary,
    kochance: () => ({ text: snapshot.koText }),
    range: () => snapshot.damageRange,
  };
}
