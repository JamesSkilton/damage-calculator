export type CalculatorMode = {
  slug: string;
  label: string;
  title: string;
  description: string;
  placeholderTodo: string;
};

export const calculatorModes = [
  {
    slug: 'one-vs-one',
    label: 'One vs One',
    title: 'One vs One',
    description: 'The default matchup view for direct attacker versus defender comparisons.',
    placeholderTodo: 'TODO: migrate the legacy one-vs-one calculator UI into this route.',
  },
  {
    slug: 'one-vs-all',
    label: 'One vs All',
    title: 'One vs All',
    description: 'A spread view for comparing one attacker against many targets.',
    placeholderTodo: 'TODO: migrate the one-vs-all target list and results flow into this route.',
  },
  {
    slug: 'all-vs-one',
    label: 'All vs One',
    title: 'All vs One',
    description: 'A defensive view for comparing multiple attackers into one target.',
    placeholderTodo: 'TODO: migrate the all-vs-one attacker comparison flow into this route.',
  },
  {
    slug: 'champions',
    label: 'Champions',
    title: 'Champions',
    description: 'A mode dedicated to champion battles and their calculator presets.',
    placeholderTodo: 'TODO: migrate the champion preset experience into this route.',
  },
  {
    slug: 'randoms',
    label: 'Random Battles',
    title: 'Random Battles',
    description: 'Random battle matchups with the same shared calculator shell.',
    placeholderTodo: 'TODO: migrate the random battles presets and matchup rules into this route.',
  },
  {
    slug: 'oms',
    label: 'Other Metagames',
    title: 'Other Metagames',
    description: 'Other metagame presets and their calculator-specific rules.',
    placeholderTodo: 'TODO: migrate the other metagames preset catalog into this route.',
  },
] satisfies readonly CalculatorMode[];

export const defaultModeSlug = calculatorModes[0].slug;
