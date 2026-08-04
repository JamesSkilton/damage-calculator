import type {
  BattleGender,
  BattleGeneration,
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

export const battleGenerations: readonly BattleGeneration[] = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
];

export const battleWeatherOptions = [
  { value: '', label: 'Clear' },
  { value: 'Sun', label: 'Sun' },
  { value: 'Rain', label: 'Rain' },
  { value: 'Sand', label: 'Sand' },
  { value: 'Hail', label: 'Hail' },
  { value: 'Snow', label: 'Snow' },
  { value: 'Harsh Sunshine', label: 'Harsh Sunshine' },
  { value: 'Heavy Rain', label: 'Heavy Rain' },
  { value: 'Strong Winds', label: 'Strong Winds' },
] as const;

export const battleTerrainOptions = [
  { value: '', label: 'No terrain' },
  { value: 'Electric', label: 'Electric' },
  { value: 'Grassy', label: 'Grassy' },
  { value: 'Misty', label: 'Misty' },
  { value: 'Psychic', label: 'Psychic' },
] as const;
