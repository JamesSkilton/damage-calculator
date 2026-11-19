import type { AiMove, RunAndBunAiContext } from './runAndBunAi';

export type Facts = {
  context: RunAndBunAiContext;
  move: AiMove;
  highest: boolean;
  kills: boolean;
};
export type Node =
  | { kind: 'add'; score: number; reason: string }
  | { kind: 'never'; reason: string }
  | {
      kind: 'condition';
      label: string;
      test: (facts: Facts) => boolean;
      yes: Node[];
      no: Node[];
    }
  | { kind: 'chance'; branches: { probability: number; nodes: Node[] }[] };

const add = (score: number, reason: string): Node => ({
  kind: 'add',
  score,
  reason,
});
const never = (reason: string): Node => ({ kind: 'never', reason });
const condition = (
  label: string,
  test: (facts: Facts) => boolean,
  yes: Node[],
  no: Node[] = [],
): Node => ({ kind: 'condition', label, test, yes, no });
const chance = (probability: number, yes: Node[], no: Node[]): Node => ({
  kind: 'chance',
  branches: [
    { probability, nodes: yes },
    { probability: 1 - probability, nodes: no },
  ],
});

const faster = ({ context }: Facts) => context.aiSpeed >= context.playerSpeed;
const threatened = ({ context }: Facts) =>
  context.playerMaxDamage >= context.aiHp;
const aiPct = ({ context }: Facts) => context.aiHp / context.aiMaxHp;
const asleep = ({ context }: Facts) =>
  context.playerStatus === 'slp' || context.playerStatus === 'frz';
const harmful = (status?: string) =>
  ['psn', 'tox', 'brn'].includes(status ?? '');

export const traps = new Set([
  'Whirlpool',
  'Fire Spin',
  'Sand Tomb',
  'Magma Storm',
  'Infestation',
  'Bind',
  'Wrap',
  'Clamp',
  'Snap Trap',
  'Thunder Cage',
]);
/** Damaging moves that never roll for "highest damage". */
export const noHighest = new Set([
  'Explosion',
  'Self-Destruct',
  'Misty Explosion',
  'Final Gambit',
  'Relic Song',
  'Rollout',
  'Meteor Beam',
  'Future Sight',
  ...traps,
]);
const boostAbilities = new Set([
  'Moxie',
  'Beast Boost',
  'Chilling Neigh',
  'Grim Neigh',
]);
const speedDrop = new Set([
  'Icy Wind',
  'Electroweb',
  'Rock Tomb',
  'Mud Shot',
  'Low Sweep',
]);
const attackDrop: Record<string, 'Physical' | 'Special'> = {
  'Trop Kick': 'Physical',
  Lunge: 'Physical',
  'Breaking Swipe': 'Physical',
  'Skitter Smack': 'Special',
  Snarl: 'Special',
  'Struggle Bug': 'Special',
  'Spirit Break': 'Special',
};
const protectedAbilities = new Set(['Contrary', 'Clear Body', 'White Smoke']);
const hazards = new Set(['Stealth Rock', 'Spikes', 'Toxic Spikes']);
const screens = new Set(['Reflect', 'Light Screen']);
const terrains = new Set([
  'Electric Terrain',
  'Psychic Terrain',
  'Grassy Terrain',
  'Misty Terrain',
]);
const protect = new Set([
  'Protect',
  'Detect',
  "King's Shield",
  'Spiky Shield',
  'Baneful Bunker',
]);
const poison = new Set([
  'Toxic',
  'Poison Powder',
  'Poison Gas',
  'Toxic Thread',
]);
const sleep = new Set([
  'Yawn',
  'Dark Void',
  'Grass Whistle',
  'Grasswhistle',
  'Sing',
  'Hypnosis',
  'Sleep Powder',
  'Spore',
  'Lovely Kiss',
]);
const paralysis = new Set(['Thunder Wave', 'Stun Spore', 'Glare']);
// These damaging moves need battle information or special rules not yet represented.
const unsupportedDamage = new Set([
  'Sucker Punch',
  'Fling',
  'Power-up Punch',
  'Charge Beam',
  'Nuzzle',
  'Zap Cannon',
  'Explosion',
  'Self-Destruct',
  'Misty Explosion',
]);
const offensiveSetup = new Set([
  'Dragon Dance',
  'Shift Gear',
  'Swords Dance',
  'Howl',
  'Sharpen',
  'Meditate',
  'Hone Claws',
]);
const defensiveSetup = new Set([
  'Acid Armor',
  'Barrier',
  'Cotton Guard',
  'Harden',
  'Iron Defense',
  'Stockpile',
  'Cosmic Power',
  'Stuff Cheeks',
]);
const specialSetup = new Set(['Tail Glow', 'Nasty Plot', 'Work Up']);
const speedSetup = new Set(['Agility', 'Rock Polish', 'Autotomize']);
const recovery = new Set([
  'Recover',
  'Slack Off',
  'Heal Order',
  'Soft-Boiled',
  'Roost',
  'Strength Sap',
  'Morning Sun',
  'Synthesis',
  'Moonlight',
  'Rest',
]);

const commonDamage: Node[] = [
  condition('Highest damaging move?', ({ highest }) => highest, [
    chance(0.8, [add(6, 'Highest damage')], [add(8, 'Highest damage')]),
  ]),
  condition('Kills the target?', ({ kills }) => kills, [
    condition(
      'AI faster, or move has priority?',
      (f) => faster(f) || f.move.priority > 0,
      [add(6, 'Fast or priority KO')],
      [add(3, 'Slow KO')],
    ),
    condition(
      'AI has Moxie, Beast Boost or a Neigh ability?',
      ({ context }) => boostAbilities.has(context.aiAbility ?? ''),
      [add(1, 'KO ability')],
    ),
  ]),
  condition(
    'Priority move, AI slower and threatened?',
    (f) => f.move.priority > 0 && !faster(f) && threatened(f),
    [add(11, 'Priority when threatened')],
  ),
];

const moveRules: Record<string, Node[]> = {
  'Future Sight': [
    condition(
      'AI faster and player can KO it?',
      (f) => faster(f) && threatened(f),
      [add(8, 'Future Sight')],
      [add(6, 'Future Sight')],
    ),
  ],
  'Relic Song': [add(10, 'Relic Song')],
  Pursuit: [
    condition(
      'Pursuit KOs, or player below 20% HP?',
      ({ kills, context }) =>
        kills || context.playerHp / context.playerMaxHp < 0.2,
      [add(10, 'Pursuit KO or low HP')],
      [
        condition(
          'Player below 40% HP?',
          ({ context }) => context.playerHp / context.playerMaxHp < 0.4,
          [chance(0.5, [add(8, 'Pursuit low HP')], [])],
        ),
      ],
    ),
    condition('AI faster?', faster, [add(3, 'Faster Pursuit')]),
  ],
  'Acid Spray': [add(6, 'Acid Spray')],
};

/** The rule graph for a move, or undefined when its rules are not modelled yet. */
export function graphFor(move: AiMove): Node[] | undefined {
  const name = move.name;
  if (move.category !== 'Status') {
    if (unsupportedDamage.has(name)) return undefined;
    if (name === 'Rollout') return [add(7, 'Rollout')];
    if (name === 'Meteor Beam')
      return [
        condition(
          'AI holds Power Herb?',
          ({ context }) => context.aiItem === 'Power Herb',
          [add(9, 'Power Herb')],
          [never('Meteor Beam without Power Herb')],
        ),
        ...commonDamage,
      ];
    if (name === 'Final Gambit')
      return [
        condition(
          'AI faster and has more HP than the player?',
          (f) => faster(f) && f.context.aiHp > f.context.playerHp,
          [add(8, 'Final Gambit KO')],
          [
            condition(
              'AI faster and player can KO it?',
              (f) => faster(f) && threatened(f),
              [add(7, 'Final Gambit threatened')],
              [add(6, 'Final Gambit')],
            ),
          ],
        ),
      ];
    const nodes: Node[] = [];
    if (name === 'Belch')
      nodes.push(
        condition(
          'Has the AI eaten a Berry?',
          ({ context }) => context.aiBerryEaten === 'yes',
          [],
          [never('Belch fails without an eaten Berry')],
        ),
      );
    if (name === 'Fake Out')
      nodes.push(
        condition(
          'First turn out?',
          ({ context }) => context.firstTurnOut,
          [],
          [never('Fake Out fails after the first turn')],
        ),
        condition(
          'Target lacks Shield Dust and Inner Focus?',
          ({ context }) =>
            !['Shield Dust', 'Inner Focus'].includes(
              context.playerAbility ?? '',
            ),
          [add(9, 'Fake Out')],
        ),
      );
    if (name === 'Relic Song')
      nodes.push(
        condition(
          'Meloetta in Pirouette form?',
          ({ context }) => Boolean(context.aiSpecies?.includes('Pirouette')),
          [never('Pirouette form')],
        ),
      );
    if (name === 'Fell Stinger') {
      // The special total replaces common scoring.
      nodes.push(
        condition(
          'Kills and Attack below +6?',
          ({ kills, context }) => kills && (context.aiAttackStage ?? 0) < 6,
          [
            condition(
              'AI faster?',
              faster,
              [
                chance(
                  0.8,
                  [add(21, 'Fell Stinger KO')],
                  [add(23, 'Fell Stinger KO')],
                ),
              ],
              [
                chance(
                  0.8,
                  [add(15, 'Fell Stinger KO')],
                  [add(17, 'Fell Stinger KO')],
                ),
              ],
            ),
          ],
          commonDamage,
        ),
      );
      return nodes;
    }
    nodes.push(...commonDamage);
    if (traps.has(name))
      nodes.push(
        chance(0.8, [add(6, 'Trapping move')], [add(8, 'Trapping move')]),
      );
    nodes.push(...(moveRules[name] ?? []));
    if (speedDrop.has(name))
      nodes.push(
        condition('Not the highest damaging move?', ({ highest }) => !highest, [
          condition(
            'AI slower and target not immune to drops?',
            (f) =>
              !faster(f) &&
              !protectedAbilities.has(f.context.playerAbility ?? ''),
            [add(6, 'Speed reduction')],
            [add(5, 'Speed reduction')],
          ),
        ]),
      );
    if (attackDrop[name])
      nodes.push(
        condition('Not the highest damaging move?', ({ highest }) => !highest, [
          condition(
            'Player has a move of that split and no immunity?',
            ({ context }) =>
              !protectedAbilities.has(context.playerAbility ?? '') &&
              context.playerMoveCategories.includes(attackDrop[name]),
            [add(6, 'Attack reduction')],
            [add(5, 'Attack reduction')],
          ),
        ]),
      );
    return nodes;
  }
  if (hazards.has(name) || name === 'Sticky Web') {
    const web = name === 'Sticky Web';
    return [
      condition(
        'First turn out?',
        ({ context }) => context.firstTurnOut,
        [
          chance(
            0.25,
            [add(web ? 9 : 8, 'First-turn hazard')],
            [add(web ? 12 : 9, 'First-turn hazard')],
          ),
        ],
        [chance(0.25, [add(6, 'Hazard')], [add(web ? 9 : 7, 'Hazard')])],
      ),
    ];
  }
  if (protect.has(name))
    return [
      add(6, 'Protect'),
      condition(
        'AI poisoned or burned?',
        ({ context }) => harmful(context.aiStatus),
        [add(-2, 'AI status')],
      ),
      condition(
        'Player poisoned or burned?',
        ({ context }) => harmful(context.playerStatus),
        [add(1, 'Player status')],
      ),
      condition('First turn out?', ({ context }) => context.firstTurnOut, [
        add(-1, 'First turn'),
      ]),
    ];
  if (screens.has(name))
    return [
      add(6, name),
      condition(
        name === 'Reflect'
          ? 'Player has a physical move?'
          : 'Player has a special move?',
        ({ context }) =>
          context.playerMoveCategories.includes(
            name === 'Reflect' ? 'Physical' : 'Special',
          ),
        [
          condition(
            'AI holds Light Clay?',
            ({ context }) => context.aiItem === 'Light Clay',
            [add(1, 'Light Clay')],
          ),
          chance(0.5, [add(1, 'Screen bonus')], []),
        ],
      ),
    ];
  if (terrains.has(name))
    return [
      condition(
        'AI holds Terrain Extender?',
        ({ context }) => context.aiItem === 'Terrain Extender',
        [add(9, 'Terrain Extender')],
        [add(8, 'Terrain')],
      ),
    ];
  if (name === 'Tailwind' || name === 'Trick Room')
    return [
      condition(
        'AI faster?',
        faster,
        [add(5, name)],
        [add(name === 'Tailwind' ? 9 : 10, name)],
      ),
    ];
  if (
    offensiveSetup.has(name) ||
    defensiveSetup.has(name) ||
    specialSetup.has(name)
  ) {
    const nodes: Node[] = [
      condition('Player can KO the AI?', threatened, [never('Player can KO')]),
      condition(
        'Player has Unaware?',
        ({ context }) =>
          context.playerAbility === 'Unaware' &&
          !['Swords Dance', 'Howl'].includes(name),
        [never('Unaware')],
      ),
      add(6, 'Setup'),
    ];
    if (defensiveSetup.has(name))
      nodes.push(
        condition('Player asleep or frozen?', asleep, [
          chance(0.95, [add(2, 'Incapacitated target')], []),
        ]),
      );
    else if (specialSetup.has(name))
      nodes.push(
        condition(
          'Player asleep or frozen?',
          asleep,
          [add(3, 'Incapacitated target')],
          [
            condition(
              'Player needs four or more hits?',
              ({ context }) => context.playerMaxDamage * 3 < context.aiHp,
              [
                condition(
                  'AI faster?',
                  faster,
                  [add(2, 'Safe setup')],
                  [add(1, 'Safe setup')],
                ),
              ],
            ),
          ],
        ),
        condition(
          'AI Attack already +2 or more?',
          ({ context }) => (context.aiAttackStage ?? 0) >= 2,
          [add(-1, 'Raised attack')],
        ),
      );
    else
      nodes.push(
        condition('Player asleep or frozen?', asleep, [
          add(3, 'Incapacitated target'),
        ]),
      );
    nodes.push(
      condition(
        'AI slower and player 2HKOs it?',
        (f) => !faster(f) && f.context.playerMaxDamage * 2 >= f.context.aiHp,
        [add(-5, 'Slow and threatened')],
      ),
    );
    return nodes;
  }
  if (speedSetup.has(name))
    return [
      condition(
        'AI already faster?',
        faster,
        [never('Already faster')],
        [add(7, 'Speed setup')],
      ),
    ];
  if (recovery.has(name)) {
    const heal = name === 'Rest' ? 1 : 0.5;
    const skip = () => add(5, 'Recovery not recommended');
    const recoveryScore =
      name === 'Rest'
        ? condition(
            'AI holds a cure berry or has Sleep Talk/Snore?',
            ({ context }) =>
              ['Lum Berry', 'Chesto Berry'].includes(context.aiItem ?? '') ||
              context.moves.some((candidate) =>
                ['Sleep Talk', 'Snore'].includes(candidate.name),
              ),
            [add(8, 'Recovery with cure')],
            [add(7, 'Recovery')],
          )
        : add(7, 'Recovery');
    return [
      condition(
        'AI at full HP?',
        ({ context }) => context.aiHp >= context.aiMaxHp,
        [never('Already full HP')],
      ),
      condition(
        'AI at 85% HP or more?',
        (f) => aiPct(f) >= 0.85,
        [add(-6, 'High HP')],
        [
          condition(
            'AI badly poisoned, or player out-damages the heal?',
            ({ context }) =>
              context.aiStatus === 'tox' ||
              context.playerMaxDamage >= context.aiMaxHp * heal,
            [skip()],
            [
              condition(
                'AI faster?',
                faster,
                [
                  condition(
                    'Threatened but survives the heal?',
                    (f) =>
                      threatened(f) &&
                      f.context.playerMaxDamage <
                        f.context.aiHp + f.context.aiMaxHp * heal,
                    [recoveryScore],
                    [
                      condition(
                        'Not threatened and below 40% HP?',
                        (f) => !threatened(f) && aiPct(f) < 0.4,
                        [recoveryScore],
                        [
                          condition(
                            'Not threatened and below 66% HP?',
                            (f) => !threatened(f) && aiPct(f) < 0.66,
                            [chance(0.5, [recoveryScore], [skip()])],
                            [skip()],
                          ),
                        ],
                      ),
                    ],
                  ),
                ],
                [
                  condition(
                    'AI below 50% HP?',
                    (f) => aiPct(f) < 0.5,
                    [recoveryScore],
                    [
                      condition(
                        'AI below 70% HP?',
                        (f) => aiPct(f) < 0.7,
                        [chance(0.75, [recoveryScore], [skip()])],
                        [skip()],
                      ),
                    ],
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    ];
  }
  if (
    poison.has(name) ||
    sleep.has(name) ||
    paralysis.has(name) ||
    name === 'Will-O-Wisp'
  )
    return [
      condition(
        'Player already has a status?',
        ({ context }) => Boolean(context.playerStatus),
        [never('Target already has a status')],
      ),
      ...(paralysis.has(name)
        ? [
            condition(
              'Player outspeeds now but not after paralysis?',
              ({ context }) =>
                context.playerSpeed > context.aiSpeed &&
                Math.floor(context.playerSpeed / 4) < context.aiSpeed,
              [add(8, 'Paralysis')],
              [add(7, 'Paralysis')],
            ),
            chance(0.5, [add(-1, 'Paralysis roll')], []),
          ]
        : [add(6, 'Status move')]),
      ...(sleep.has(name)
        ? [
            condition('Player cannot KO the AI?', (f) => !threatened(f), [
              chance(0.25, [add(1, 'Sleep bonus')], []),
            ]),
          ]
        : []),
      ...(name === 'Will-O-Wisp'
        ? [
            condition(
              'Player has a physical move?',
              ({ context }) =>
                context.playerMoveCategories.includes('Physical'),
              [chance(0.37, [add(1, 'Burn bonus')], [])],
            ),
          ]
        : []),
    ];
  // The doc gives every other status move the default +6.
  return [add(6, 'Default status score (no specific rule)')];
}

export type ViewNode =
  | { id: string; kind: 'add'; label: string; score: number }
  | { id: string; kind: 'never'; label: string }
  | {
      id: string;
      kind: 'condition';
      label: string;
      yes: ViewNode[];
      no: ViewNode[];
    }
  | {
      id: string;
      kind: 'chance';
      label: string;
      branches: { probability: number; nodes: ViewNode[] }[];
    };

/** A serialisable copy of a graph with stable path ids, used for drawing. */
export function toView(nodes: Node[], path = ''): ViewNode[] {
  return nodes.map((node, index): ViewNode => {
    const id = `${path}/${index}`;
    if (node.kind === 'add')
      return { id, kind: 'add', label: node.reason, score: node.score };
    if (node.kind === 'never') return { id, kind: 'never', label: node.reason };
    if (node.kind === 'condition')
      return {
        id,
        kind: 'condition',
        label: node.label,
        yes: toView(node.yes, `${id}:y`),
        no: toView(node.no, `${id}:n`),
      };
    return {
      id,
      kind: 'chance',
      label: node.branches.map((b) => `${Math.round(b.probability * 100)}%`)[0],
      branches: node.branches.map((b, k) => ({
        probability: b.probability,
        nodes: toView(b.nodes, `${id}:${k}`),
      })),
    };
  });
}
