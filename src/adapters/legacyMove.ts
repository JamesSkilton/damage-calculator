import type {
  BattleMove,
  BattleMoveCategory,
  BattleMoveFlag,
  BattleMoveTarget,
  BattleGeneration,
  BattleStatId,
  BattleTypeName,
} from '../domain';
import { mergeLegacy, toLegacyId, type LegacyGeneration } from './legacyShared';

export interface LegacyMoveData {
  id?: string;
  name: string;
  basePower: number;
  type: BattleTypeName;
  category?: BattleMoveCategory;
  flags: Partial<Record<BattleMoveFlag, 0 | 1>>;
  secondaries?: unknown;
  target?: BattleMoveTarget;
  recoil?: readonly [number, number];
  hasCrashDamage?: boolean;
  mindBlownRecoil?: boolean;
  struggleRecoil?: boolean;
  willCrit?: boolean;
  drain?: readonly [number, number];
  priority?: number;
  self?: { boosts?: Partial<Record<BattleStatId, number>> } | null;
  ignoreDefensive?: boolean;
  overrideOffensiveStat?: Exclude<BattleStatId, 'hp'>;
  overrideDefensiveStat?: Exclude<BattleStatId, 'hp'>;
  overrideOffensivePokemon?: 'target' | 'source';
  overrideDefensivePokemon?: 'target' | 'source';
  breaksProtect?: boolean;
  isZ?: boolean | string;
  zMove?: { basePower?: number };
  isMax?: boolean | string;
  maxMove?: { basePower: number };
  multihit?: number | number[];
  multiaccuracy?: boolean;
}

export interface LegacyMoveInput {
  name: string;
  useZ?: boolean;
  useMax?: boolean;
  isCrit?: boolean;
  isStellarFirstUse?: boolean;
  hits?: number;
  timesUsed?: number;
  timesUsedWithMetronome?: number;
  ability?: string;
  item?: string;
  species?: string;
  overrides?: Partial<LegacyMoveData>;
}

const SPECIAL = [
  'Fire',
  'Water',
  'Grass',
  'Electric',
  'Ice',
  'Psychic',
  'Dark',
  'Dragon',
];

function getMoveData(
  generation: LegacyGeneration<unknown, LegacyMoveData>,
  input: LegacyMoveInput,
): LegacyMoveData {
  const move = generation.moves.get(toLegacyId(input.name));

  if (!move) {
    throw new Error(`Unknown move: ${input.name}`);
  }

  return mergeLegacy(move, input.overrides);
}

function getZMoveName(
  moveName: string,
  moveType: BattleTypeName,
  item?: string,
): string {
  item = item || '';

  if (moveName.includes('Hidden Power')) {
    return 'Breakneck Blitz';
  }
  if (moveName === 'Clanging Scales' && item === 'Kommonium Z')
    return 'Clangorous Soulblaze';
  if (moveName === 'Darkest Lariat' && item === 'Incinium Z')
    return 'Malicious Moonsault';
  if (moveName === 'Giga Impact' && item === 'Snorlium Z')
    return 'Pulverizing Pancake';
  if (moveName === 'Moongeist Beam' && item === 'Lunalium Z')
    return 'Menacing Moonraze Maelstrom';
  if (moveName === 'Photon Geyser' && item === 'Ultranecrozium Z') {
    return 'Light That Burns the Sky';
  }
  if (moveName === 'Play Rough' && item === 'Mimikium Z')
    return "Let's Snuggle Forever";
  if (moveName === 'Psychic' && item === 'Mewnium Z')
    return 'Genesis Supernova';
  if (moveName === 'Sparkling Aria' && item === 'Primarium Z')
    return 'Oceanic Operetta';
  if (moveName === 'Spectral Thief' && item === 'Marshadium Z') {
    return 'Soul-Stealing 7-Star Strike';
  }
  if (moveName === 'Spirit Shackle' && item === 'Decidium Z')
    return 'Sinister Arrow Raid';
  if (moveName === 'Stone Edge' && item === 'Lycanium Z')
    return 'Splintered Stormshards';
  if (moveName === 'Sunsteel Strike' && item === 'Solganium Z')
    return 'Searing Sunraze Smash';
  if (moveName === 'Volt Tackle' && item === 'Pikanium Z')
    return 'Catastropika';
  if (moveName === "Nature's Madness" && item === 'Tapunium Z')
    return 'Guardian of Alola';
  if (moveName === 'Thunderbolt') {
    if (item === 'Aloraichium Z') return 'Stoked Sparksurfer';
    if (item === 'Pikashunium Z') return '10,000,000 Volt Thunderbolt';
  }

  const zMove = ZMOVES_TYPING[moveType];
  if (!zMove) {
    throw new Error(`Unsupported Z-move type: ${moveType}`);
  }

  return zMove;
}

function getMaxMoveName(
  moveType: BattleTypeName,
  moveName?: string,
  pokemonSpecies?: string,
  isStatus?: boolean,
  pokemonAbility?: string,
): string {
  if (isStatus) {
    return 'Max Guard';
  }
  if (pokemonAbility === 'Normalize') {
    return 'Max Strike';
  }
  if (moveType === 'Fire') {
    if (pokemonSpecies === 'Charizard-Gmax') return 'G-Max Wildfire';
    if (pokemonSpecies === 'Centiskorch-Gmax') return 'G-Max Centiferno';
    if (pokemonSpecies === 'Cinderace-Gmax') return 'G-Max Fire Ball';
  }
  if (moveType === 'Normal') {
    if (pokemonSpecies === 'Eevee-Gmax') return 'G-Max Cuddle';
    if (pokemonSpecies === 'Meowth-Gmax') return 'G-Max Gold Rush';
    if (pokemonSpecies === 'Snorlax-Gmax') return 'G-Max Replenish';
    if (!(moveName === 'Weather Ball' || moveName === 'Terrain Pulse')) {
      if (pokemonAbility === 'Pixilate') return 'Max Starfall';
      if (pokemonAbility === 'Aerilate') return 'Max Airstream';
      if (pokemonAbility === 'Refrigerate') return 'Max Hailstorm';
      if (pokemonAbility === 'Galvanize') return 'Max Lightning';
    }
  }
  if (moveType === 'Fairy') {
    if (pokemonSpecies === 'Alcremie-Gmax') return 'G-Max Finale';
    if (pokemonSpecies === 'Hatterene-Gmax') return 'G-Max Smite';
  }
  if (moveType === 'Steel') {
    if (pokemonSpecies === 'Copperajah-Gmax') return 'G-Max Steelsurge';
    if (pokemonSpecies === 'Melmetal-Gmax') return 'G-Max Meltdown';
  }
  if (moveType === 'Electric') {
    if (pokemonSpecies === 'Pikachu-Gmax') return 'G-Max Volt Crash';
    if (
      pokemonSpecies?.startsWith('Toxtricity') &&
      pokemonSpecies?.endsWith('Gmax')
    ) {
      return 'G-Max Stun Shock';
    }
  }
  if (moveType === 'Grass') {
    if (pokemonSpecies === 'Appletun-Gmax') return 'G-Max Sweetness';
    if (pokemonSpecies === 'Flapple-Gmax') return 'G-Max Tartness';
    if (pokemonSpecies === 'Rillaboom-Gmax') return 'G-Max Drum Solo';
    if (pokemonSpecies === 'Venusaur-Gmax') return 'G-Max Vine Lash';
  }
  if (moveType === 'Water') {
    if (pokemonSpecies === 'Blastoise-Gmax') return 'G-Max Cannonade';
    if (pokemonSpecies === 'Drednaw-Gmax') return 'G-Max Stonesurge';
    if (pokemonSpecies === 'Inteleon-Gmax') return 'G-Max Hydrosnipe';
    if (pokemonSpecies === 'Kingler-Gmax') return 'G-Max Foam Burst';
    if (pokemonSpecies === 'Urshifu-Rapid-Strike-Gmax')
      return 'G-Max Rapid Flow';
  }
  if (moveType === 'Dark') {
    if (pokemonSpecies === 'Grimmsnarl-Gmax') return 'G-Max Snooze';
    if (pokemonSpecies === 'Urshifu-Gmax') return 'G-Max One Blow';
  }
  if (moveType === 'Poison' && pokemonSpecies === 'Garbodor-Gmax')
    return 'G-Max Malodor';
  if (moveType === 'Fighting' && pokemonSpecies === 'Machamp-Gmax')
    return 'G-Max Chi Strike';
  if (moveType === 'Ghost' && pokemonSpecies === 'Gengar-Gmax')
    return 'G-Max Terror';
  if (moveType === 'Ice' && pokemonSpecies === 'Lapras-Gmax')
    return 'G-Max Resonance';
  if (moveType === 'Flying' && pokemonSpecies === 'Corviknight-Gmax')
    return 'G-Max Wind Rage';
  if (moveType === 'Dragon' && pokemonSpecies === 'Duraludon-Gmax')
    return 'G-Max Depletion';
  if (moveType === 'Psychic' && pokemonSpecies === 'Orbeetle-Gmax')
    return 'G-Max Gravitas';
  if (moveType === 'Rock' && pokemonSpecies === 'Coalossal-Gmax')
    return 'G-Max Volcalith';
  if (moveType === 'Ground' && pokemonSpecies === 'Sandaconda-Gmax')
    return 'G-Max Sandblast';

  const maxMove = MAXMOVES_TYPING[moveType];
  if (!maxMove) {
    throw new Error(`Unsupported Max Move type: ${moveType}`);
  }

  return `Max ${maxMove}`;
}

function resolveMoveData(
  generation: LegacyGeneration<unknown, LegacyMoveData>,
  input: LegacyMoveInput,
  baseData: LegacyMoveData,
): LegacyMoveData {
  if (input.useMax && baseData.maxMove) {
    const maxMoveName = getMaxMoveName(
      baseData.type,
      baseData.name,
      input.species,
      baseData.category === 'Status',
      input.ability,
    );
    const maxMove = generation.moves.get(toLegacyId(maxMoveName)) as
      LegacyMoveData | undefined;

    if (!maxMove) {
      throw new Error(`Unknown max move: ${maxMoveName}`);
    }

    const maxPower = () => {
      if (
        ['G-Max Drum Solo', 'G-Max Fire Ball', 'G-Max Hydrosnipe'].includes(
          maxMoveName,
        )
      ) {
        return 160;
      }

      if (maxMove.basePower === 10 || maxMoveName === 'Max Flare') {
        return baseData.maxMove!.basePower;
      }

      return maxMove.basePower;
    };

    return {
      ...mergeLegacy(maxMove, input.overrides),
      name: maxMoveName,
      basePower: maxPower(),
      category: baseData.category,
    } as LegacyMoveData;
  }

  if (input.useZ && baseData.zMove?.basePower) {
    const zMoveName = getZMoveName(baseData.name, baseData.type, input.item);
    const zMove = generation.moves.get(toLegacyId(zMoveName)) as
      LegacyMoveData | undefined;

    if (!zMove) {
      throw new Error(`Unknown z-move: ${zMoveName}`);
    }

    return {
      ...mergeLegacy(zMove, input.overrides),
      name: zMoveName,
      basePower:
        zMove.basePower === 1 ? baseData.zMove.basePower : zMove.basePower,
      category: baseData.category,
    } as LegacyMoveData;
  }

  return mergeLegacy(baseData, input.overrides);
}

function inferMoveCategory(
  generation: BattleGeneration,
  data: LegacyMoveData,
): BattleMove['category'] {
  if (data.category) {
    return data.category;
  }

  return generation > 0 && generation < 4
    ? SPECIAL.includes(data.type)
      ? 'Special'
      : 'Physical'
    : 'Status';
}

function getMoveHits(data: LegacyMoveData, input: LegacyMoveInput): number {
  if (!data.multihit) {
    return input.hits || 1;
  }

  if (data.multiaccuracy && typeof data.multihit === 'number') {
    return input.hits || data.multihit;
  }

  if (typeof data.multihit === 'number') {
    return data.multihit;
  }

  if (input.hits) {
    return input.hits;
  }

  return input.ability === 'Skill Link'
    ? data.multihit[1]
    : data.multihit[0] + 1;
}

export function mapLegacyMoveToBattleMove(
  generation: LegacyGeneration<unknown, LegacyMoveData>,
  input: LegacyMoveInput,
): BattleMove {
  const baseData = getMoveData(generation, input);
  const data = resolveMoveData(generation, input, baseData);
  const moveId = toLegacyId(data.name || baseData.name);
  const typelessDamage =
    ((generation.num === 0 || generation.num >= 2) && moveId === 'struggle') ||
    (generation.num > 0 &&
      generation.num <= 4 &&
      ['futuresight', 'doomdesire'].includes(moveId));
  const moveType = typelessDamage ? '???' : data.type;

  const basePower =
    data.basePower ||
    (['return', 'frustration', 'pikapapow', 'veeveevolley'].includes(moveId)
      ? 102
      : 0);

  return {
    generation: generation.num,
    name: data.name,
    basePower,
    type: moveType,
    category: inferMoveCategory(generation.num, data),
    flags: { ...data.flags },
    target: data.target || 'any',
    recoil: data.recoil,
    drain: data.drain,
    priority: data.priority || 0,
    hits: getMoveHits(data, input),
    isCrit:
      !!input.isCrit ||
      !!data.willCrit ||
      (generation.num === 1 &&
        ['crabhammer', 'razorleaf', 'slash', 'karatechop'].includes(moveId)),
    isZ: !!data.isZ,
    isMax: !!data.isMax,
    isStellarFirstUse: !!input.isStellarFirstUse,
    timesUsed: input.timesUsed || 1,
    timesUsedWithMetronome: input.timesUsedWithMetronome,
    hasCrashDamage: !!data.hasCrashDamage,
    mindBlownRecoil: !!data.mindBlownRecoil,
    struggleRecoil: !!data.struggleRecoil,
    breaksProtect: !!data.breaksProtect,
    ignoreDefensive: !!data.ignoreDefensive,
    multiaccuracy: !!data.multiaccuracy,
    overrideOffensiveStat: data.overrideOffensiveStat,
    overrideDefensiveStat: data.overrideDefensiveStat,
    overrideOffensivePokemon: data.overrideOffensivePokemon,
    overrideDefensivePokemon: data.overrideDefensivePokemon,
    secondaries: data.secondaries,
    self: data.self,
  };
}

const ZMOVES_TYPING: Partial<Record<BattleTypeName, string>> = {
  Bug: 'Savage Spin-Out',
  Dark: 'Black Hole Eclipse',
  Dragon: 'Devastating Drake',
  Electric: 'Gigavolt Havoc',
  Fairy: 'Twinkle Tackle',
  Fighting: 'All-Out Pummeling',
  Fire: 'Inferno Overdrive',
  Flying: 'Supersonic Skystrike',
  Ghost: 'Never-Ending Nightmare',
  Grass: 'Bloom Doom',
  Ground: 'Tectonic Rage',
  Ice: 'Subzero Slammer',
  Normal: 'Breakneck Blitz',
  Poison: 'Acid Downpour',
  Psychic: 'Shattered Psyche',
  Rock: 'Continental Crush',
  Steel: 'Corkscrew Crash',
  Water: 'Hydro Vortex',
};

const MAXMOVES_TYPING: Partial<Record<BattleTypeName, string>> = {
  Bug: 'Flutterby',
  Dark: 'Darkness',
  Dragon: 'Wyrmwind',
  Electric: 'Lightning',
  Fairy: 'Starfall',
  Fighting: 'Knuckle',
  Fire: 'Flare',
  Flying: 'Airstream',
  Ghost: 'Phantasm',
  Grass: 'Overgrowth',
  Ground: 'Quake',
  Ice: 'Hailstorm',
  Normal: 'Strike',
  Poison: 'Ooze',
  Psychic: 'Mindstorm',
  Rock: 'Rockfall',
  Steel: 'Steelspike',
  Water: 'Geyser',
};
