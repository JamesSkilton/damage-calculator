import type * as I from './data/interface';
import type {State} from './state';
import {toID, extend} from './util';

const SPECIAL = ['Fire', 'Water', 'Grass', 'Electric', 'Ice', 'Psychic', 'Dark', 'Dragon'];

export interface Move extends State.Move {
  gen: I.Generation;
  name: I.MoveName;
  originalName: string;
  ability?: I.AbilityName;
  item?: I.ItemName;
  species?: I.SpeciesName;
  useZ?: boolean;
  useMax?: boolean;
  overrides?: Partial<I.Move>;
  hits: number;
  timesUsed?: number;
  timesUsedWithMetronome?: number;
  bp: number;
  type: I.TypeName;
  category: I.MoveCategory;
  flags: I.MoveFlags;
  secondaries: any;
  target: I.MoveTarget;
  recoil?: [number, number];
  hasCrashDamage: boolean;
  mindBlownRecoil: boolean;
  struggleRecoil: boolean;
  isCrit: boolean;
  isStellarFirstUse: boolean;
  drain?: [number, number];
  priority: number;
  dropsStats?: number;
  ignoreDefensive: boolean;
  overrideOffensiveStat?: I.StatIDExceptHP;
  overrideDefensiveStat?: I.StatIDExceptHP;
  overrideOffensivePokemon?: 'target' | 'source';
  overrideDefensivePokemon?: 'target' | 'source';
  breaksProtect: boolean;
  isZ: boolean;
  isMax: boolean;
  multiaccuracy: boolean;
  named(...names: string[]): boolean;
  hasType(...types: Array<(I.TypeName | undefined)>): boolean;
  clone(): Move;
}

export function Move(
  gen: I.Generation,
  name: string,
  options: Partial<State.Move> & {
    ability?: I.AbilityName;
    item?: I.ItemName;
    species?: I.SpeciesName;
  } = {}
): Move {
  name = options.name || name;
  const originalName = name;
  let data: I.Move = extend(true, {name}, gen.moves.get(toID(name)), options.overrides);

  let hits = 1;
  let timesUsedWithMetronome: number | undefined;

  if (options.useMax && data.maxMove) {
    const maxMoveName: string = getMaxMoveName(
      data.type,
      data.name,
      options.species,
      !!(data.category === 'Status'),
      options.ability
    );
    const maxMove = gen.moves.get(toID(maxMoveName));
    const maxPower = () => {
      if (['G-Max Drum Solo', 'G-Max Fire Ball', 'G-Max Hydrosnipe'].includes(maxMoveName)) {
        return 160;
      }
      if (maxMove!.basePower === 10 || maxMoveName === 'Max Flare') {
        return data.maxMove!.basePower;
      }
      return maxMove!.basePower;
    };
    data = extend(true, {}, maxMove, {
      name: maxMoveName,
      basePower: maxPower(),
      category: data.category,
    });
  } else if (options.useZ && data.zMove?.basePower) {
    const zMoveName: string = getZMoveName(data.name, data.type, options.item);
    const zMove = gen.moves.get(toID(zMoveName));
    data = extend(true, {}, zMove, {
      name: zMoveName,
      basePower: zMove!.basePower === 1 ? data.zMove.basePower : zMove!.basePower,
      category: data.category,
    });
  } else {
    if (data.multihit) {
      if (data.multiaccuracy && typeof data.multihit === 'number') {
        hits = options.hits || data.multihit;
      } else {
        if (typeof data.multihit === 'number') {
          hits = data.multihit;
        } else if (options.hits) {
          hits = options.hits;
        } else {
          hits = (options.ability === 'Skill Link')
            ? data.multihit[1]
            : data.multihit[0] + 1;
        }
      }
    }
    timesUsedWithMetronome = options.timesUsedWithMetronome;
  }

  const typelessDamage =
    ((gen.num === 0 || gen.num >= 2) && data.id === 'struggle') ||
    ((gen.num > 0 && gen.num <= 4) && ['futuresight', 'doomdesire'].includes(data.id));

  const type = typelessDamage ? '???' : data.type;
  const category = data.category ||
    (gen.num > 0 && gen.num < 4
      ? (SPECIAL.includes(data.type) ? 'Special' : 'Physical')
      : 'Status');

  const stat = category === 'Special' ? 'spa' : 'atk';
  let dropsStats: number | undefined;
  if (data.self?.boosts && data.self.boosts[stat] && data.self.boosts[stat]! < 0) {
    dropsStats = Math.abs(data.self.boosts[stat]!);
  }

  let bp = data.basePower;
  if (!bp) {
    if (['return', 'frustration', 'pikapapow', 'veeveevolley'].includes(data.id)) {
      bp = 102;
    }
  }

  const self: Move = {
    gen,
    name: data.name,
    originalName,
    ability: options.ability,
    item: options.item,
    useZ: options.useZ,
    useMax: options.useMax,
    overrides: options.overrides,
    species: options.species,
    hits,
    timesUsedWithMetronome,
    bp,
    type: type as I.TypeName,
    category,
    flags: data.flags,
    secondaries: data.secondaries,
    target: data.target || 'any',
    recoil: data.recoil,
    hasCrashDamage: !!data.hasCrashDamage,
    mindBlownRecoil: !!data.mindBlownRecoil,
    struggleRecoil: !!data.struggleRecoil,
    isCrit: !!options.isCrit || !!data.willCrit ||
      gen.num === 1 && ['crabhammer', 'razorleaf', 'slash', 'karate chop'].includes(data.id),
    isStellarFirstUse: !!options.isStellarFirstUse,
    drain: data.drain,
    priority: data.priority || 0,
    dropsStats,
    timesUsed: options.timesUsed || 1,
    ignoreDefensive: !!data.ignoreDefensive,
    overrideOffensiveStat: data.overrideOffensiveStat,
    overrideDefensiveStat: data.overrideDefensiveStat,
    overrideOffensivePokemon: data.overrideOffensivePokemon,
    overrideDefensivePokemon: data.overrideDefensivePokemon,
    breaksProtect: !!data.breaksProtect,
    isZ: !!data.isZ,
    isMax: !!data.isMax,
    multiaccuracy: !!data.multiaccuracy,
    named(...names: string[]) { return names.includes(self.name); },
    hasType(...types: Array<(I.TypeName | undefined)>) { return types.includes(self.type); },
    clone() {
      return Move(self.gen, self.originalName, {
        ability: self.ability,
        item: self.item,
        species: self.species,
        useZ: self.useZ,
        useMax: self.useMax,
        isCrit: self.isCrit,
        isStellarFirstUse: self.isStellarFirstUse,
        hits: self.hits,
        timesUsed: self.timesUsed,
        timesUsedWithMetronome: self.timesUsedWithMetronome,
        overrides: self.overrides,
      });
    },
  };
  return self;
}

export function getZMoveName(moveName: string, moveType: I.TypeName, item?: string) {
  item = item || '';
  if (moveName.includes('Hidden Power')) return 'Breakneck Blitz';
  if (moveName === 'Clanging Scales' && item === 'Kommonium Z') return 'Clangorous Soulblaze';
  if (moveName === 'Darkest Lariat' && item === 'Incinium Z') return 'Malicious Moonsault';
  if (moveName === 'Giga Impact' && item === 'Snorlium Z') return 'Pulverizing Pancake';
  if (moveName === 'Moongeist Beam' && item === 'Lunalium Z') return 'Menacing Moonraze Maelstrom';
  if (moveName === 'Photon Geyser' && item === 'Ultranecrozium Z') {
    return 'Light That Burns the Sky';
  }
  if (moveName === 'Play Rough' && item === 'Mimikium Z') return 'Let\'s Snuggle Forever';
  if (moveName === 'Psychic' && item === 'Mewnium Z') return 'Genesis Supernova';
  if (moveName === 'Sparkling Aria' && item === 'Primarium Z') return 'Oceanic Operetta';
  if (moveName === 'Spectral Thief' && item === 'Marshadium Z') {
    return 'Soul-Stealing 7-Star Strike';
  }
  if (moveName === 'Spirit Shackle' && item === 'Decidium Z') return 'Sinister Arrow Raid';
  if (moveName === 'Stone Edge' && item === 'Lycanium Z') return 'Splintered Stormshards';
  if (moveName === 'Sunsteel Strike' && item === 'Solganium Z') return 'Searing Sunraze Smash';
  if (moveName === 'Volt Tackle' && item === 'Pikanium Z') return 'Catastropika';
  if (moveName === 'Nature\'s Madness' && item === 'Tapunium Z') return 'Guardian of Alola';
  if (moveName === 'Thunderbolt') {
    if (item === 'Aloraichium Z') return 'Stoked Sparksurfer';
    if (item === 'Pikashunium Z') return '10,000,000 Volt Thunderbolt';
  }
  return ZMOVES_TYPING[moveType]!;
}

const ZMOVES_TYPING: {
  [type in I.TypeName]?: string;
} = {
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

export function getMaxMoveName(
  moveType: I.TypeName,
  moveName?: string,
  pokemonSpecies?: string,
  isStatus?: boolean,
  pokemonAbility?: string
) {
  if (isStatus) return 'Max Guard';
  if (pokemonAbility === 'Normalize') return 'Max Strike';
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
    if (pokemonSpecies?.startsWith('Toxtricity') &&
      pokemonSpecies?.endsWith('Gmax')) return 'G-Max Stun Shock';
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
    if (pokemonSpecies === 'Urshifu-Rapid-Strike-Gmax') return 'G-Max Rapid Flow';
  }
  if (moveType === 'Dark') {
    if (pokemonSpecies === 'Grimmsnarl-Gmax') return 'G-Max Snooze';
    if (pokemonSpecies === 'Urshifu-Gmax') return 'G-Max One Blow';
  }
  if (moveType === 'Poison' && pokemonSpecies === 'Garbodor-Gmax') return 'G-Max Malodor';
  if (moveType === 'Fighting' && pokemonSpecies === 'Machamp-Gmax') return 'G-Max Chi Strike';
  if (moveType === 'Ghost' && pokemonSpecies === 'Gengar-Gmax') return 'G-Max Terror';
  if (moveType === 'Ice' && pokemonSpecies === 'Lapras-Gmax') return 'G-Max Resonance';
  if (moveType === 'Flying' && pokemonSpecies === 'Corviknight-Gmax') return 'G-Max Wind Rage';
  if (moveType === 'Dragon' && pokemonSpecies === 'Duraludon-Gmax') return 'G-Max Depletion';
  if (moveType === 'Psychic' && pokemonSpecies === 'Orbeetle-Gmax') return 'G-Max Gravitas';
  if (moveType === 'Rock' && pokemonSpecies === 'Coalossal-Gmax') return 'G-Max Volcalith';
  if (moveType === 'Ground' && pokemonSpecies === 'Sandaconda-Gmax') return 'G-Max Sandblast';
  if (moveType === 'Dark' && pokemonSpecies === 'Grimmsnarl-Gmax') return 'G-Max Snooze';
  return 'Max ' + MAXMOVES_TYPING[moveType];
}

const MAXMOVES_TYPING: {
  [type in I.TypeName]?: string;
} = {
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
