import type * as I from './data/interface';
import {Stats} from './stats';
import {toID, extend, assignWithout} from './util';
import type {State} from './state';

const STATS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as I.StatID[];
const SPC = new Set(['spc']);

export interface Pokemon extends State.Pokemon {
  gen: I.Generation;
  name: I.SpeciesName;
  species: I.Specie;
  types: [I.TypeName] | [I.TypeName, I.TypeName];
  weightkg: number;
  level: number;
  gender?: I.GenderName;
  ability?: I.AbilityName;
  abilityOn?: boolean;
  isDynamaxed?: boolean;
  dynamaxLevel?: number;
  alliesFainted?: number;
  boostedStat?: I.StatIDExceptHP | 'auto';
  item?: I.ItemName;
  disabledItem?: I.ItemName;
  teraType?: I.TypeName;
  nature: I.NatureName;
  ivs: I.StatsTable;
  evs: I.StatsTable;
  boosts: I.StatsTable;
  rawStats: I.StatsTable;
  stats: I.StatsTable;
  originalCurHP: number;
  status: I.StatusName | '';
  toxicCounter: number;
  moves: I.MoveName[];
  maxHP(original?: boolean): number;
  curHP(original?: boolean): number;
  hasAbility(...abilities: string[]): boolean;
  hasItem(...items: string[]): boolean;
  hasStatus(...statuses: I.StatusName[]): boolean;
  hasType(...types: I.TypeName[]): boolean;
  hasOriginalType(...types: I.TypeName[]): boolean;
  named(...names: string[]): boolean;
  clone(): Pokemon;
}

export function Pokemon(
  gen: I.Generation,
  name: string,
  options: Partial<State.Pokemon> & {
    curHP?: number;
    ivs?: Partial<I.StatsTable> & {spc?: number};
    evs?: Partial<I.StatsTable> & {spc?: number};
    boosts?: Partial<I.StatsTable> & {spc?: number};
  } = {}
): Pokemon {
  const species = extend(true, {}, gen.species.get(toID(name)), options.overrides) as I.Specie;
  const level = gen.num === 0 ? 50 : options.level || 100;
  const nature = options.nature || ('Serious' as I.NatureName);
  const ivs = pokemonWithDefault(gen, gen.num === 0 ? {} : options.ivs, 31);
  const evs = pokemonWithDefault(gen, options.evs, gen.num === 0 || gen.num >= 3 ? 0 : 252);
  const boosts = pokemonWithDefault(gen, options.boosts, 0, false);

  let weightkg = species.weightkg;
  if (weightkg === 0 && !options.isDynamaxed && species.baseSpecies) {
    weightkg = gen.species.get(toID(species.baseSpecies))!.weightkg;
  }

  if (gen.num > 0 && gen.num < 3) {
    ivs.hp = Stats.DVToIV(
      Stats.getHPDV({
        atk: ivs.atk,
        def: ivs.def,
        spe: ivs.spe,
        spc: ivs.spa,
      })
    );
  }

  const rawStats = {} as I.StatsTable;
  const stats = {} as I.StatsTable;
  for (const stat of STATS) {
    const val = Stats.calcStat(gen, stat, species.baseStats[stat], ivs[stat]!, evs[stat]!, level, nature);
    rawStats[stat] = val;
    stats[stat] = val;
  }

  const curHP = options.curHP || options.originalCurHP;
  const isDynamaxed = !!options.isDynamaxed;
  const dynamaxLevel = isDynamaxed
    ? (options.dynamaxLevel === undefined ? 10 : options.dynamaxLevel) : undefined;

  const self: Pokemon = {
    gen,
    name: options.name || name as I.SpeciesName,
    species,
    types: species.types,
    weightkg,
    level,
    gender: options.gender || species.gender || 'M',
    ability: options.ability || species.abilities?.[0] || undefined,
    abilityOn: !!options.abilityOn,
    isDynamaxed,
    dynamaxLevel,
    alliesFainted: options.alliesFainted,
    boostedStat: options.boostedStat,
    teraType: options.teraType,
    item: options.item,
    nature,
    ivs,
    evs,
    boosts,
    rawStats,
    stats,
    originalCurHP: curHP && curHP <= rawStats.hp ? curHP : rawStats.hp,
    status: options.status || '',
    toxicCounter: options.toxicCounter || 0,
    moves: options.moves || [],
    maxHP(original = false) {
      if (!original && self.isDynamaxed && self.species.baseStats.hp !== 1) {
        return Math.floor((self.rawStats.hp * (150 + 5 * self.dynamaxLevel!)) / 100);
      }
      return self.rawStats.hp;
    },
    curHP(original = false) {
      if (!original && self.isDynamaxed && self.species.baseStats.hp !== 1) {
        return Math.ceil((self.originalCurHP * (150 + 5 * self.dynamaxLevel!)) / 100);
      }
      return self.originalCurHP;
    },
    hasAbility(...abilities: string[]) {
      return !!(self.ability && abilities.includes(self.ability));
    },
    hasItem(...items: string[]) {
      return !!(self.item && items.includes(self.item));
    },
    hasStatus(...statuses: I.StatusName[]) {
      return !!(self.status && statuses.includes(self.status));
    },
    hasType(...types: I.TypeName[]) {
      for (const type of types) {
        if (self.teraType && self.teraType !== 'Stellar'
          ? self.teraType === type : self.types.includes(type)) {
          return true;
        }
      }
      return false;
    },
    /** Ignores Tera type */
    hasOriginalType(...types: I.TypeName[]) {
      for (const type of types) {
        if (self.types.includes(type)) return true;
      }
      return false;
    },
    named(...names: string[]) {
      return names.includes(self.name);
    },
    clone() {
      return Pokemon(self.gen, self.name, {
        level: self.level,
        ability: self.ability,
        abilityOn: self.abilityOn,
        isDynamaxed: self.isDynamaxed,
        dynamaxLevel: self.dynamaxLevel,
        alliesFainted: self.alliesFainted,
        boostedStat: self.boostedStat,
        item: self.item,
        gender: self.gender,
        nature: self.nature,
        ivs: extend(true, {}, self.ivs),
        evs: extend(true, {}, self.evs),
        boosts: extend(true, {}, self.boosts),
        originalCurHP: self.originalCurHP,
        status: self.status,
        teraType: self.teraType,
        toxicCounter: self.toxicCounter,
        moves: self.moves.slice(),
        overrides: self.species,
      });
    },
  };
  return self;
}

export function getPokemonForme(
  gen: I.Generation,
  speciesName: string,
  item?: I.ItemName,
  moveName?: I.MoveName
) {
  const species = gen.species.get(toID(speciesName));
  if (!species?.otherFormes) {
    return speciesName;
  }

  let i = 0;
  if (
    (item &&
      ((item.includes('ite') && !item.includes('ite Y')) ||
        (speciesName === 'Groudon' && item === 'Red Orb') ||
        (speciesName === 'Kyogre' && item === 'Blue Orb'))) ||
    (moveName && speciesName === 'Meloetta' && moveName === 'Relic Song') ||
    (speciesName === 'Rayquaza' && moveName === 'Dragon Ascent')
  ) {
    i = 1;
  } else if (item?.includes('ite Y')) {
    i = 2;
  }

  return i ? species.otherFormes[i - 1] : species.name;
}

function pokemonWithDefault(
  gen: I.Generation,
  current: Partial<I.StatsTable> & {spc?: number} | undefined,
  val: number,
  match = true,
) {
  const cur: Partial<I.StatsTable> = {};
  if (current) {
    assignWithout(cur, current, SPC);
    if (current.spc !== undefined) {
      cur.spa = current.spc;
      cur.spd = current.spc;
    }
    if (match && gen.num > 0 && gen.num <= 2 && current.spa !== current.spd) {
      throw new Error('Special Attack and Special Defense must match in Gen 1 and Gen 2');
    }
  }
  return {hp: val, atk: val, def: val, spa: val, spd: val, spe: val, ...cur};
}
