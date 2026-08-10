import type * as I from './interface';

import {Abilities} from './abilities';
import {Items} from './items';
import {Moves} from './moves';
import {Species} from './species';
import {Types} from './types';
import {Natures} from './natures';

export const Generations: I.Generations = {
  get(gen: I.GenerationNum) {
    return createGeneration(gen);
  },
};

function createGeneration(num: I.GenerationNum): I.Generation {
  return {
    num,
    abilities: Abilities(num),
    items: Items(num),
    moves: Moves(num),
    species: Species(num),
    types: Types(num),
    natures: Natures,
  };
}
