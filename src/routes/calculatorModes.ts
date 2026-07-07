export type CalculatorMode = {
  slug: string;
  label: string;
  title: string;
  description: string;
};

export const calculatorModes = [
  {
    slug: 'one-vs-one',
    label: 'One vs One',
    title: 'One vs One',
    description: 'The default matchup view for direct attacker versus defender comparisons.',
  },
  {
    slug: 'one-vs-all',
    label: 'One vs All',
    title: 'One vs All',
    description: 'A spread view for comparing one attacker against many targets.',
  },
  {
    slug: 'all-vs-one',
    label: 'All vs One',
    title: 'All vs One',
    description: 'A defensive view for comparing multiple attackers into one target.',
  },
  {
    slug: 'champions',
    label: 'Champions',
    title: 'Champions',
    description: 'A mode dedicated to champion battles and their calculator presets.',
  },
  {
    slug: 'randoms',
    label: 'Random Battles',
    title: 'Random Battles',
    description: 'Random battle matchups with the same shared calculator shell.',
  },
  {
    slug: 'oms',
    label: 'Other Metagames',
    title: 'Other Metagames',
    description: 'Other metagame presets and their calculator-specific rules.',
  },
] satisfies readonly CalculatorMode[];

export const defaultModeSlug = calculatorModes[0].slug;
