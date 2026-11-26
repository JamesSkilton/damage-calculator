// @ts-nocheck
import { Field } from './field';
import type { Generation } from './data/interface';
import type { Move } from './move';
import type { Pokemon } from './pokemon';
import type { Result } from './result';

import { calculateChampions } from './mechanics/champions';
import { calculateRBYGSC } from './mechanics/gen12';
import { calculateADV } from './mechanics/gen3';
import { calculateDPP } from './mechanics/gen4';
import { calculateBWXY } from './mechanics/gen56';
import { calculateSMSSSV } from './mechanics/gen789';

const MECHANICS = [
  calculateChampions,
  calculateRBYGSC,
  calculateRBYGSC,
  calculateADV,
  calculateDPP,
  calculateBWXY,
  calculateBWXY,
  calculateSMSSSV,
  calculateSMSSSV,
  calculateSMSSSV,
];

export function calculate(
  gen: Generation,
  attacker: Pokemon,
  defender: Pokemon,
  move: Move,
  field?: Field,
  skipIntimidate = false,
) {
  const attackerCopy = attacker.clone();
  const defenderCopy = defender.clone();
  attackerCopy.skipIntimidate = skipIntimidate;
  defenderCopy.skipIntimidate = skipIntimidate;
  return MECHANICS[gen.num](
    gen,
    attackerCopy,
    defenderCopy,
    move.clone(),
    field ? field.clone() : Field(),
  );
}
