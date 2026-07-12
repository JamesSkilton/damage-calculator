import type { BattleTypeName } from '@/domain';
import {
  MAXMOVES_TYPING,
  ZMOVES_TYPING,
} from '@/adapters/legacyMove.constants';

export function getZMoveName(
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

export function getMaxMoveName(
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
