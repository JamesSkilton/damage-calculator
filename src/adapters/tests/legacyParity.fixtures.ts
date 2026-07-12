import type {
  BattleCombatant,
  BattleField,
  BattleGeneration,
  BattleMove,
  BattleSideConditions,
  BattleStatBoosts,
  BattleStats,
  BattleTypeName,
} from '@/domain';

export interface LegacyParityFixture {
  id: string;
  title: string;
  input: {
    generation: BattleGeneration;
    attacker: BattleCombatant;
    defender: BattleCombatant;
    move: BattleMove;
    field: BattleField;
  };
  expected: {
    range: readonly [number, number];
    koText: string;
    summary: string;
  };
}

const statBlock = (value: number): BattleStats => ({
  hp: value,
  atk: value,
  def: value,
  spa: value,
  spd: value,
  spe: value,
});

const defaultIvs = statBlock(31);
const defaultModernEvs = statBlock(0);
const defaultGen1And2Evs = statBlock(252);
const defaultBoosts: BattleStatBoosts = statBlock(0);

const blankSide = (): BattleSideConditions => ({
  spikes: 0,
  steelsurge: false,
  vinelash: false,
  wildfire: false,
  cannonade: false,
  volcalith: false,
  isSR: false,
  isReflect: false,
  isLightScreen: false,
  isProtected: false,
  isSeeded: false,
  isSaltCured: false,
  isForesight: false,
  isTailwind: false,
  isHelpingHand: false,
  isFlowerGift: false,
  isPowerTrick: false,
  isFriendGuard: false,
  isAuroraVeil: false,
  isBattery: false,
  isPowerSpot: false,
  isSteelySpirit: false,
  isSwitching: undefined,
});

const makeField = (
  generation: BattleGeneration,
  overrides: Partial<
    Omit<BattleField, 'generation' | 'attackerSide' | 'defenderSide'>
  > & {
    attackerSide?: Partial<BattleSideConditions>;
    defenderSide?: Partial<BattleSideConditions>;
  } = {},
): BattleField => {
  const { attackerSide, defenderSide, ...rest } = overrides;

  return {
    generation,
    gameType: 'Singles',
    weather: undefined,
    terrain: undefined,
    isMagicRoom: false,
    isWonderRoom: false,
    isGravity: false,
    isAuraBreak: false,
    isFairyAura: false,
    isDarkAura: false,
    isBeadsOfRuin: false,
    isSwordOfRuin: false,
    isTabletsOfRuin: false,
    isVesselOfRuin: false,
    attackerSide: { ...blankSide(), ...attackerSide },
    defenderSide: { ...blankSide(), ...defenderSide },
    ...rest,
  };
};

const makeCombatant = (
  generation: BattleGeneration,
  name: string,
  species: string,
  types: readonly [BattleTypeName] | readonly [BattleTypeName, BattleTypeName],
  currentHp: number,
  overrides: Partial<BattleCombatant> = {},
): BattleCombatant => {
  const {
    level,
    nature,
    ivs,
    evs,
    boosts,
    toxicCounter,
    abilityOn,
    isDynamaxed,
    moves,
    ...rest
  } = overrides;

  return {
    generation,
    name,
    species,
    level: level ?? 100,
    nature: nature ?? 'Serious',
    types,
    ivs: ivs ?? defaultIvs,
    evs: evs ?? (generation <= 2 ? defaultGen1And2Evs : defaultModernEvs),
    boosts: boosts ?? defaultBoosts,
    currentHp,
    toxicCounter: toxicCounter ?? 0,
    abilityOn: abilityOn ?? false,
    isDynamaxed: isDynamaxed ?? false,
    moves: moves ?? [name],
    ...rest,
  };
};

const makeMove = (
  generation: BattleGeneration,
  name: string,
  overrides: Partial<BattleMove> &
    Pick<BattleMove, 'basePower' | 'category' | 'target' | 'type'>,
): BattleMove => {
  const {
    basePower,
    category,
    target,
    type,
    flags,
    priority,
    hits,
    isCrit,
    isZ,
    isMax,
    isStellarFirstUse,
    timesUsed,
    timesUsedWithMetronome,
    hasCrashDamage,
    mindBlownRecoil,
    struggleRecoil,
    breaksProtect,
    ignoreDefensive,
    multiaccuracy,
    recoil,
    drain,
    secondaries,
    self,
    ...rest
  } = overrides;

  return {
    generation,
    name,
    basePower,
    type,
    category,
    flags: flags ?? {},
    target,
    priority: priority ?? 0,
    hits: hits ?? 1,
    isCrit: isCrit ?? false,
    isZ: isZ ?? false,
    isMax: isMax ?? false,
    isStellarFirstUse: isStellarFirstUse ?? false,
    timesUsed: timesUsed ?? 1,
    timesUsedWithMetronome: timesUsedWithMetronome ?? 1,
    hasCrashDamage: hasCrashDamage ?? false,
    mindBlownRecoil: mindBlownRecoil ?? false,
    struggleRecoil: struggleRecoil ?? false,
    breaksProtect: breaksProtect ?? false,
    ignoreDefensive: ignoreDefensive ?? false,
    multiaccuracy: multiaccuracy ?? false,
    recoil,
    drain,
    secondaries,
    self,
    ...rest,
  };
};

export const legacyParityFixtures: readonly LegacyParityFixture[] = [
  {
    id: 'gen2-night-shade',
    title: 'Gen 1/2 baseline damage',
    input: {
      generation: 2,
      attacker: makeCombatant(2, 'Mew', 'Mew', ['Psychic'], 206, {
        level: 50,
        moves: ['Night Shade'],
      }),
      defender: makeCombatant(2, 'Vulpix', 'Vulpix', ['Fire'], 279, {
        moves: [],
      }),
      move: makeMove(2, 'Night Shade', {
        basePower: 0,
        type: 'Ghost',
        category: 'Special',
        target: 'any',
      }),
      field: makeField(2),
    },
    expected: {
      range: [50, 50],
      koText: 'guaranteed 6HKO',
      summary:
        'Lvl 50 Mew Night Shade vs. Vulpix: 50-50 (17.9 - 17.9%) -- guaranteed 6HKO',
    },
  },
  {
    id: 'gen4-judgment-plate',
    title: 'Gen 3/4 plate modifier',
    input: {
      generation: 4,
      attacker: makeCombatant(4, 'Arceus', 'Arceus', ['Normal'], 381, {
        item: 'Meadow Plate',
        moves: ['Judgment'],
      }),
      defender: makeCombatant(4, 'Blastoise', 'Blastoise', ['Water'], 299, {
        moves: [],
      }),
      move: makeMove(4, 'Judgment', {
        basePower: 100,
        type: 'Normal',
        category: 'Special',
        target: 'any',
      }),
      field: makeField(4),
    },
    expected: {
      range: [194, 230],
      koText: 'guaranteed 2HKO',
      summary:
        '0 SpA Meadow Plate Arceus Judgment vs. 0 HP / 0 SpD Blastoise: 194-230 (64.8 - 76.9%) -- guaranteed 2HKO',
    },
  },
  {
    id: 'gen4-weather-ball-sand',
    title: 'Weather Ball picks up sandstorm typing',
    input: {
      generation: 4,
      attacker: makeCombatant(4, 'Castform', 'Castform', ['Normal'], 281, {
        moves: ['Weather Ball'],
      }),
      defender: makeCombatant(
        4,
        'Bulbasaur',
        'Bulbasaur',
        ['Grass', 'Poison'],
        231,
        {
          moves: [],
        },
      ),
      move: makeMove(4, 'Weather Ball', {
        basePower: 50,
        type: 'Normal',
        category: 'Special',
        target: 'any',
      }),
      field: makeField(4, { weather: 'Sand' }),
    },
    expected: {
      range: [77, 91],
      koText: 'guaranteed 3HKO after sandstorm damage',
      summary:
        '0 SpA Castform Weather Ball (100 BP Rock) vs. 0 HP / 0 SpD Bulbasaur in Sand: 77-91 (33.3 - 39.3%) -- guaranteed 3HKO after sandstorm damage',
    },
  },
  {
    id: 'gen9-ring-target-sludge-bomb',
    title: 'Gen 5+ immunity is negated by Ring Target',
    input: {
      generation: 9,
      attacker: makeCombatant(9, 'Mew', 'Mew', ['Psychic'], 341, {
        moves: ['Sludge Bomb'],
      }),
      defender: makeCombatant(
        9,
        'Skarmory',
        'Skarmory',
        ['Steel', 'Flying'],
        271,
        {
          item: 'Ring Target',
          moves: [],
        },
      ),
      move: makeMove(9, 'Sludge Bomb', {
        basePower: 90,
        type: 'Poison',
        category: 'Special',
        target: 'any',
        flags: { bullet: 1 },
        secondaries: true,
      }),
      field: makeField(9),
    },
    expected: {
      range: [87, 103],
      koText: '94.6% chance to 3HKO',
      summary:
        '0 SpA Mew Sludge Bomb vs. 0 HP / 0 SpD Skarmory: 87-103 (32.1 - 38%) -- 94.6% chance to 3HKO',
    },
  },
  {
    id: 'gen6-crit-explosion',
    title: 'Critical hit damage ignores attack drops and Reflect',
    input: {
      generation: 6,
      attacker: makeCombatant(6, 'Mew', 'Mew', ['Psychic'], 341, {
        status: 'brn',
        moves: ['Explosion'],
      }),
      defender: makeCombatant(6, 'Vulpix', 'Vulpix', ['Fire'], 217, {
        moves: [],
      }),
      move: makeMove(6, 'Explosion', {
        basePower: 250,
        type: 'Normal',
        category: 'Physical',
        target: 'allAdjacent',
        isCrit: true,
      }),
      field: makeField(6, { defenderSide: { isReflect: true } }),
    },
    expected: {
      range: [273, 321],
      koText: 'guaranteed OHKO',
      summary:
        '0 Atk burned Mew Explosion vs. 0 HP / 0 Def Vulpix on a critical hit: 273-321 (125.8 - 147.9%) -- guaranteed OHKO',
    },
  },
  {
    id: 'gen9-protect-hyper-beam',
    title: 'Protect blanks the hit',
    input: {
      generation: 9,
      attacker: makeCombatant(9, 'Snorlax', 'Snorlax', ['Normal'], 461, {
        moves: ['Hyper Beam'],
      }),
      defender: makeCombatant(9, 'Chansey', 'Chansey', ['Normal'], 641, {
        moves: [],
      }),
      move: makeMove(9, 'Hyper Beam', {
        basePower: 150,
        type: 'Normal',
        category: 'Special',
        target: 'any',
      }),
      field: makeField(9, { defenderSide: { isProtected: true } }),
    },
    expected: {
      range: [0, 0],
      koText: '',
      summary: 'Snorlax Hyper Beam vs. protected Chansey: 0-0 (0 - 0%)',
    },
  },
  {
    id: 'gen9-comet-punch',
    title: 'Multi-hit damage stays stable',
    input: {
      generation: 9,
      attacker: makeCombatant(9, 'Snorlax', 'Snorlax', ['Normal'], 461, {
        moves: ['Comet Punch'],
      }),
      defender: makeCombatant(9, 'Vulpix', 'Vulpix', ['Fire'], 217, {
        moves: [],
      }),
      move: makeMove(9, 'Comet Punch', {
        basePower: 18,
        type: 'Normal',
        category: 'Physical',
        target: 'any',
        flags: { contact: 1, punch: 1 },
        hits: 3,
      }),
      field: makeField(9),
    },
    expected: {
      range: [129, 156],
      koText: 'guaranteed 2HKO',
      summary:
        '0 Atk Snorlax Comet Punch (3 hits) vs. 0 HP / 0 Def Vulpix: 129-156 (59.4 - 71.8%) -- guaranteed 2HKO',
    },
  },
] as const;
