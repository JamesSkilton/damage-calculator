import type {
  BattleGender,
  BattleStatusName,
  BattleTypeName,
} from 'domain/index';

export const battleTypes: readonly BattleTypeName[] = [
  'Normal',
  'Fighting',
  'Flying',
  'Poison',
  'Ground',
  'Rock',
  'Bug',
  'Ghost',
  'Steel',
  'Fire',
  'Water',
  'Grass',
  'Electric',
  'Psychic',
  'Ice',
  'Dragon',
  'Dark',
  'Fairy',
  'Stellar',
  '???',
];

export const battleGenders: readonly BattleGender[] = ['M', 'F', 'N'];
export const battleStatuses: readonly (BattleStatusName | '')[] = [
  '',
  'slp',
  'psn',
  'brn',
  'frz',
  'par',
  'tox',
];
