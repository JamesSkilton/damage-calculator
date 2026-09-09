import { Generations } from 'calc-runtime/core/data/index';
import { toID } from 'calc-runtime/core/util';
import type { BattleGeneration, BattleStatId, BattleStats, BattleTypeName } from 'domain/index';
import { emptyStats, SET_STAT_IDS, type ImportedPokemonSet } from './pokemonSet';

export interface ParsePokemonSetsResult {
  sets: ImportedPokemonSet[];
  errors: string[];
}

const STAT_NAMES: Record<string, BattleStatId> = {
  hp: 'hp',
  atk: 'atk',
  attack: 'atk',
  def: 'def',
  defense: 'def',
  spa: 'spa',
  spc: 'spa',
  'sp. atk': 'spa',
  spd: 'spd',
  'sp. def': 'spd',
  spe: 'spe',
  speed: 'spe',
};

function lookupName(collection: { get(id: string): { name: string } | undefined }, value: string) {
  return collection.get(toID(value))?.name;
}

function parseHeader(line: string): { nickname?: string; species: string; item?: string; gender?: 'M' | 'F' } | undefined {
  const match = line.match(/^(.*?)\s*(?:@\s*(.+))?$/);
  if (!match) return undefined;

  const left = match[1].trim();
  const item = match[2]?.trim() || undefined;
  const nicknameMatch = left.match(/^(.*?)\s*\(([^()]+)\)$/);
  const candidate = nicknameMatch?.[2].trim() || left;
  const gender = candidate === 'M' || candidate === 'F' ? candidate : undefined;
  const species = gender ? (nicknameMatch?.[1].trim() || '') : candidate;
  if (!species) return undefined;

  return {
    nickname: !gender && nicknameMatch && species ? nicknameMatch[1].trim() || undefined : undefined,
    species,
    item,
    gender,
  };
}

function parseStats(value: string, errors: string[], lineNumber: number): Partial<Record<BattleStatId, number>> {
  const stats: Partial<Record<BattleStatId, number>> = {};
  for (const part of value.split('/')) {
    const match = part.trim().match(/^(\d+)\s+(.+)$/);
    if (!match) {
      errors.push(`Line ${lineNumber}: invalid stat entry "${part.trim()}".`);
      continue;
    }
    const stat = STAT_NAMES[match[2].trim().toLowerCase()];
    if (!stat) {
      errors.push(`Line ${lineNumber}: unknown stat "${match[2].trim()}".`);
      continue;
    }
    stats[stat] = Number(match[1]);
  }
  return stats;
}

export function parsePokemonSets(text: string, generation: BattleGeneration = 9): ParsePokemonSetsResult {
  const catalog = Generations.get(generation);
  const sets: ImportedPokemonSet[] = [];
  const errors: string[] = [];
  const blocks = text.split(/\r?\n\s*\r?\n/).map((block) => block.trim()).filter(Boolean);

  blocks.forEach((block, blockIndex) => {
    const lines = block.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const header = parseHeader(lines[0] || '');
    if (!header) {
      errors.push(`Set ${blockIndex + 1}: missing Pokemon header.`);
      return;
    }
    const species = lookupName(catalog.species, header.species);
    if (!species) {
      errors.push(`Set ${blockIndex + 1}: unknown species "${header.species}".`);
      return;
    }

    const evs = emptyStats(0);
    const ivs = emptyStats(31);
    let level = 100;
    let nature = 'Serious';
    let ability: string | undefined;
    const item = header.item ? lookupName(catalog.items, header.item) : undefined;
    let teraType: BattleTypeName | undefined;
    const moves: string[] = [];

    if (header.item && !item) errors.push(`Set ${blockIndex + 1}: unknown item "${header.item}".`);
    for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
      const line = lines[lineIndex];
      const prefixMatch = line.match(/^([^:]+):\s*(.*)$/);
      if (line.startsWith('-')) {
        const move = lookupName(catalog.moves, line.slice(1).trim());
        if (move) moves.push(move);
        else errors.push(`Set ${blockIndex + 1}: unknown move "${line.slice(1).trim()}".`);
      } else if (prefixMatch) {
        const key = prefixMatch[1].toLowerCase();
        const value = prefixMatch[2].trim();
        if (key === 'ability') {
          ability = lookupName(catalog.abilities, value);
          if (!ability) errors.push(`Set ${blockIndex + 1}: unknown ability "${value}".`);
        } else if (key === 'level') {
          const parsed = Number(value);
          if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 100) level = parsed;
          else errors.push(`Set ${blockIndex + 1}: invalid level "${value}".`);
        } else if (key === 'tera type') {
          const type = lookupName(catalog.types, value);
          if (type) teraType = type as BattleTypeName;
          else errors.push(`Set ${blockIndex + 1}: unknown Tera Type "${value}".`);
        } else if (key === 'evs' || key === 'ivs') {
          const parsed = parseStats(value, errors, lineIndex + 1);
          Object.assign(key === 'evs' ? evs : ivs, parsed);
        }
      } else if (line.endsWith(' Nature')) {
        const candidate = line.slice(0, -' Nature'.length).trim();
        const resolved = lookupName(catalog.natures, candidate);
        if (resolved) nature = resolved;
        else errors.push(`Set ${blockIndex + 1}: unknown nature "${candidate}".`);
      }
    }

    sets.push({
      id: `${toID(species)}-${toID(header.nickname || species)}-${sets.length}`,
      generation,
      species,
      nickname: header.nickname,
      level,
      gender: header.gender,
      ability,
      item,
      nature,
      teraType,
      evs,
      ivs,
      moves: moves.slice(0, 4),
    });
  });

  return { sets, errors };
}

export function formatStatLine(stats: BattleStats, includeValue: (value: number) => boolean): string {
  const labels: Record<BattleStatId, string> = { hp: 'HP', atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe' };
  return SET_STAT_IDS.filter((stat) => includeValue(stats[stat])).map((stat) => `${stats[stat]} ${labels[stat]}`).join(' / ');
}