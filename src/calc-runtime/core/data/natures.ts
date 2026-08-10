import type * as I from './interface';
import {toID} from '../util';

export const NATURES: {[name: string]: [I.StatID, I.StatID]} = {
  Adamant: ['atk', 'spa'],
  Bashful: ['spa', 'spa'],
  Bold: ['def', 'atk'],
  Brave: ['atk', 'spe'],
  Calm: ['spd', 'atk'],
  Careful: ['spd', 'spa'],
  Docile: ['def', 'def'],
  Gentle: ['spd', 'def'],
  Hardy: ['atk', 'atk'],
  Hasty: ['spe', 'def'],
  Impish: ['def', 'spa'],
  Jolly: ['spe', 'spa'],
  Lax: ['def', 'spd'],
  Lonely: ['atk', 'def'],
  Mild: ['spa', 'def'],
  Modest: ['spa', 'atk'],
  Naive: ['spe', 'spd'],
  Naughty: ['atk', 'spd'],
  Quiet: ['spa', 'spe'],
  Quirky: ['spd', 'spd'],
  Rash: ['spa', 'spd'],
  Relaxed: ['def', 'spe'],
  Sassy: ['spd', 'spe'],
  Serious: ['spe', 'spe'],
  Timid: ['spe', 'atk'],
};

export const Natures: I.Natures = {
  get(id: I.ID) {
    return NATURES_BY_ID[id];
  },

  *[Symbol.iterator]() {
    for (const id in NATURES_BY_ID) {
      yield NATURES_BY_ID[id as I.ID]!;
    }
  },
};

function createNature(name: string, [plus, minus]: [I.StatID, I.StatID]): I.Nature {
  return {
    kind: 'Nature',
    id: toID(name),
    name: name as I.NatureName,
    plus,
    minus,
  };
}

const NATURES_BY_ID: {[id: string]: I.Nature} = {};

for (const nature in NATURES) {
  const n = createNature(nature, NATURES[nature] as [I.StatID, I.StatID]);
  NATURES_BY_ID[n.id] = n;
}
