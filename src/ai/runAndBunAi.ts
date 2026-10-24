/**
 * Move-scoring model for the Pokémon Run & Bun (1.07) opponent AI, following
 * ai-doc-run-bun.md. Singles only. The AI scores every move, with several
 * random components, and clicks the highest score (ties are random), so the
 * prediction is a Monte Carlo estimate of how often each move wins.
 *
 * Not modelled (needs turn history or doubles state): Sucker Punch/Protect
 * repeat penalties, Imprison, Baton Pass, Memento, Contrary, partner moves,
 * crit-chance bonuses and the cases the doc itself omits.
 */

export type AiMoveCategory = 'Physical' | 'Special' | 'Status';

export interface AiMove {
  name: string;
  category: AiMoveCategory;
  priority: number;
  /** Damage rolls against the player's active Pokémon; ignored for status moves. */
  damageRolls: readonly number[];
}

export interface RunAndBunAiContext {
  aiSpecies?: string;
  aiHp: number;
  aiMaxHp: number;
  aiSpeed: number;
  aiAbility?: string;
  aiItem?: string;
  aiStatus?: string;
  aiAttackStage?: number;
  playerHp: number;
  playerMaxHp: number;
  playerSpeed: number;
  playerAbility?: string;
  playerStatus?: string;
  /** Categories of the player's known moves. */
  playerMoveCategories: readonly AiMoveCategory[];
  /** Highest damage any player move can deal to the AI Pokémon. */
  playerMaxDamage: number;
  firstTurnOut: boolean;
  moves: readonly AiMove[];
}

export interface AiMovePrediction {
  name: string;
  /** Probability (0-1) that the AI clicks this move. */
  chance: number;
}

const NEVER = -20;

const NO_ROLL_MOVES = new Set([
  'Explosion',
  'Self-Destruct',
  'Misty Explosion',
  'Final Gambit',
  'Relic Song',
  'Rollout',
  'Meteor Beam',
  'Future Sight',
]);
const TRAPPING = new Set([
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
const BOOM = new Set(['Explosion', 'Self-Destruct', 'Misty Explosion']);
const SPEED_DROP = new Set([
  'Icy Wind',
  'Electroweb',
  'Rock Tomb',
  'Mud Shot',
  'Low Sweep',
]);
const ATTACK_DROP: Record<string, AiMoveCategory> = {
  'Trop Kick': 'Physical',
  Lunge: 'Physical',
  'Breaking Swipe': 'Physical',
  'Skitter Smack': 'Special',
  Snarl: 'Special',
  'Struggle Bug': 'Special',
  'Spirit Break': 'Special',
};
const KILL_BOOST_ABILITIES = new Set([
  'Moxie',
  'Beast Boost',
  'Chilling Neigh',
  'Grim Neigh',
]);
const OFFENSIVE_SETUP = new Set([
  'Dragon Dance',
  'Shift Gear',
  'Swords Dance',
  'Howl',
  'Sharpen',
  'Meditate',
  'Hone Claws',
  'Power-up Punch',
  'Charge Beam',
]);
const DEFENSIVE_SETUP = new Set([
  'Acid Armor',
  'Barrier',
  'Cotton Guard',
  'Harden',
  'Iron Defense',
  'Stockpile',
  'Cosmic Power',
  'Stuff Cheeks',
]);
const MIXED_SETUP_PHYSICAL = new Set(['Coil', 'Bulk Up', 'No Retreat']);
const MIXED_SETUP_SPECIAL = new Set(['Calm Mind', 'Quiver Dance']);
const SPECIAL_SETUP = new Set(['Tail Glow', 'Nasty Plot', 'Work Up']);
const UNAWARE_EXEMPT = new Set(['Power-up Punch', 'Swords Dance', 'Howl']);
const GENERAL_SETUP = new Set([
  ...OFFENSIVE_SETUP,
  ...DEFENSIVE_SETUP,
  ...MIXED_SETUP_PHYSICAL,
  ...MIXED_SETUP_SPECIAL,
  ...SPECIAL_SETUP,
  'Shell Smash',
  'Growth',
  'Curse',
]);
const SPEED_SETUP = new Set(['Agility', 'Rock Polish', 'Autotomize']);
const PROTECT = new Set([
  'Protect',
  'Detect',
  "King's Shield",
  'Spiky Shield',
  'Baneful Bunker',
]);
const HAZARDS = new Set(['Stealth Rock', 'Spikes', 'Toxic Spikes']);
const PARALYSIS = new Set([
  'Thunder Wave',
  'Stun Spore',
  'Glare',
  'Nuzzle',
  'Zap Cannon',
]);
const SLEEP = new Set([
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
const POISON = new Set(['Toxic', 'Poison Powder', 'Poison Gas', 'Toxic Thread']);
const RECOVERY = new Set([
  'Recover',
  'Slack Off',
  'Heal Order',
  'Soft-Boiled',
  'Roost',
  'Strength Sap',
  'Morning Sun',
  'Synthesis',
  'Moonlight',
]);
const TERRAIN = new Set([
  'Electric Terrain',
  'Psychic Terrain',
  'Grassy Terrain',
  'Misty Terrain',
]);
const STATUS_CURE_ITEMS = new Set(['Lum Berry', 'Chesto Berry']);

type Rng = () => number;

function mulberry32(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function scoreMoves(
  context: RunAndBunAiContext,
  rng: Rng,
): Map<string, number> {
  const {
    moves,
    aiHp,
    aiMaxHp,
    playerHp,
    playerMaxDamage,
    playerMoveCategories,
  } = context;
  const faster = context.aiSpeed >= context.playerSpeed;
  const aiPct = aiMaxHp > 0 ? aiHp / aiMaxHp : 1;
  const playerPct =
    context.playerMaxHp > 0 ? playerHp / context.playerMaxHp : 1;
  const playerKills = playerMaxDamage >= aiHp;
  const playerTwoHko = playerMaxDamage * 2 >= aiHp;
  const playerThreeHko = playerMaxDamage * 3 >= aiHp;
  const incapacitated =
    context.playerStatus === 'slp' || context.playerStatus === 'frz';
  const playerHasPhysical = playerMoveCategories.includes('Physical');
  const playerHasSpecial = playerMoveCategories.includes('Special');
  const names = new Set(moves.map((move) => move.name));

  const rolls = new Map<string, number>();
  for (const move of moves) {
    if (move.category === 'Status' || move.damageRolls.length === 0) continue;
    rolls.set(
      move.name,
      move.damageRolls[Math.floor(rng() * move.damageRolls.length)],
    );
  }
  const rolledMoves = moves.filter(
    (move) =>
      rolls.has(move.name) &&
      !NO_ROLL_MOVES.has(move.name) &&
      !TRAPPING.has(move.name),
  );
  const anyKill = rolledMoves.some(
    (move) => (rolls.get(move.name) ?? 0) >= playerHp,
  );
  const topDamage = Math.max(
    0,
    ...rolledMoves.map((move) => rolls.get(move.name) ?? 0),
  );

  const shouldRecover = (heal: number): boolean => {
    if (context.aiStatus === 'tox') return false;
    const healed = aiMaxHp * heal;
    if (playerMaxDamage >= healed) return false;
    if (faster) {
      if (playerKills && playerMaxDamage < aiHp + healed) return true;
      if (!playerKills) {
        if (aiPct < 0.4) return true;
        if (aiPct < 0.66) return rng() < 0.5;
      }
      return false;
    }
    if (aiPct < 0.5) return true;
    if (aiPct < 0.7) return rng() < 0.75;
    return false;
  };

  const setupScore = (
    name: string,
    kind: 'offense' | 'defense' | 'special',
  ): number => {
    if (playerKills) return NEVER;
    if (context.playerAbility === 'Unaware' && !UNAWARE_EXEMPT.has(name)) {
      return NEVER;
    }
    let score = 6;
    if (kind === 'special') {
      if (incapacitated) score += 3;
      else if (!playerThreeHko) score += faster ? 2 : 1;
      if ((context.aiAttackStage ?? 0) >= 2) score -= 1;
    } else if (kind === 'offense') {
      if (incapacitated) score += 3;
    } else if (rng() < 0.95 && incapacitated) {
      score += 2;
    }
    if (!faster && playerTwoHko) score -= 5;
    return score;
  };

  const damagingScore = (move: AiMove): number => {
    const roll = rolls.get(move.name) ?? 0;
    const excluded = NO_ROLL_MOVES.has(move.name) || TRAPPING.has(move.name);
    const kills = roll >= playerHp;
    const isHighest =
      !excluded && (anyKill ? kills : roll === topDamage && roll > 0);
    const base = () => (rng() < 0.8 ? 6 : 8);

    if (BOOM.has(move.name)) {
      if (aiPct < 0.1) return 10;
      if (aiPct < 0.33) return rng() < 0.7 ? 8 : 0;
      if (aiPct < 0.66) return rng() < 0.5 ? 7 : 0;
      return rng() < 0.05 ? 7 : 0;
    }
    if (move.name === 'Rollout') return 7;
    if (move.name === 'Meteor Beam') {
      return context.aiItem === 'Power Herb' ? 9 : NEVER;
    }
    if (move.name === 'Relic Song' && context.aiSpecies?.includes('Pirouette')) {
      return NEVER;
    }
    if (move.name === 'Final Gambit') {
      if (faster && aiHp > playerHp) return 8;
      return faster && playerKills ? 7 : 6;
    }
    if (
      move.name === 'Fell Stinger' &&
      kills &&
      (context.aiAttackStage ?? 0) < 6
    ) {
      const high = rng() < 0.8;
      return faster ? (high ? 21 : 23) : high ? 15 : 17;
    }

    let score = 0;
    if (isHighest) score += base();
    if (kills) {
      score += faster || move.priority > 0 ? 6 : 3;
      if (context.aiAbility && KILL_BOOST_ABILITIES.has(context.aiAbility)) {
        score += 1;
      }
    }
    if (TRAPPING.has(move.name)) score += base();
    if (move.name === 'Relic Song') score += 10;
    if (move.name === 'Future Sight') score += faster && playerKills ? 8 : 6;
    if (move.name === 'Pursuit') {
      if (kills || playerPct < 0.2) score += 10;
      else if (playerPct < 0.4 && rng() < 0.5) score += 8;
      if (faster) score += 3;
    }
    if (move.priority > 0 && playerKills && !faster) score += 11;

    if (!isHighest) {
      if (SPEED_DROP.has(move.name)) score += faster ? 5 : 6;
      const dropSplit = ATTACK_DROP[move.name];
      if (dropSplit) {
        const hasSplit =
          dropSplit === 'Physical' ? playerHasPhysical : playerHasSpecial;
        score += hasSplit ? 6 : 5;
      }
    }
    if (move.name === 'Acid Spray') score += 6;
    return score;
  };

  const statusScore = (move: AiMove): number => {
    const { name } = move;
    const playerHasStatus = Boolean(context.playerStatus);

    if (GENERAL_SETUP.has(name) && playerKills) return NEVER;
    if (OFFENSIVE_SETUP.has(name)) return setupScore(name, 'offense');
    if (DEFENSIVE_SETUP.has(name)) return setupScore(name, 'defense');
    if (SPECIAL_SETUP.has(name)) return setupScore(name, 'special');
    if (MIXED_SETUP_PHYSICAL.has(name)) {
      const defensive = playerHasPhysical && !playerHasSpecial;
      return setupScore(name, defensive ? 'defense' : 'offense');
    }
    if (MIXED_SETUP_SPECIAL.has(name)) {
      const defensive = playerHasSpecial && !playerHasPhysical;
      return setupScore(name, defensive ? 'defense' : 'offense');
    }
    if (SPEED_SETUP.has(name)) return faster ? NEVER : 7;
    if (name === 'Shell Smash') {
      if ((context.aiAttackStage ?? 0) >= 1) return NEVER;
      return incapacitated ? 9 : 8;
    }
    if (name === 'Belly Drum') {
      const hpAfter = aiHp - aiMaxHp / 2;
      if (hpAfter <= 0) return NEVER;
      if (incapacitated) return 9;
      return playerMaxDamage >= hpAfter ? 4 : 8;
    }
    if (name === 'Focus Energy' || name === 'Laser Focus') {
      return context.aiAbility === 'Super Luck' ||
        context.aiAbility === 'Sniper' ||
        context.aiItem === 'Scope Lens'
        ? 7
        : 6;
    }
    if (HAZARDS.has(name)) {
      const high = rng() < 0.75;
      return context.firstTurnOut ? (high ? 9 : 8) : high ? 7 : 6;
    }
    if (name === 'Sticky Web') {
      const high = rng() < 0.75;
      return context.firstTurnOut ? (high ? 12 : 9) : high ? 9 : 6;
    }
    if (PROTECT.has(name)) {
      let score = 6;
      if (['psn', 'tox', 'brn'].includes(context.aiStatus ?? '')) score -= 2;
      if (['psn', 'tox', 'brn'].includes(context.playerStatus ?? '')) score += 1;
      if (context.firstTurnOut) score -= 1;
      return score;
    }
    if (PARALYSIS.has(name)) {
      if (playerHasStatus) return NEVER;
      const outspedAfterPar =
        context.playerSpeed > context.aiSpeed &&
        Math.floor(context.playerSpeed / 4) < context.aiSpeed;
      return (outspedAfterPar ? 8 : 7) - (rng() < 0.5 ? 1 : 0);
    }
    if (name === 'Will-O-Wisp') {
      if (playerHasStatus) return NEVER;
      return 6 + (rng() < 0.37 && playerHasPhysical ? 1 : 0);
    }
    if (SLEEP.has(name)) {
      if (playerHasStatus) return NEVER;
      return 6 + (rng() < 0.25 && !playerKills ? 1 : 0);
    }
    if (POISON.has(name)) return playerHasStatus ? NEVER : 6;
    if (RECOVERY.has(name)) {
      if (aiHp >= aiMaxHp) return NEVER;
      if (aiPct >= 0.85) return -6;
      return shouldRecover(0.5) ? 7 : 5;
    }
    if (name === 'Rest') {
      if (aiHp >= aiMaxHp) return NEVER;
      if (aiPct >= 0.85) return -6;
      if (!shouldRecover(1)) return 5;
      const cures =
        STATUS_CURE_ITEMS.has(context.aiItem ?? '') ||
        names.has('Sleep Talk') ||
        names.has('Snore');
      return cures ? 8 : 7;
    }
    if (name === 'Light Screen' || name === 'Reflect') {
      const covered = playerMoveCategories.includes(
        name === 'Reflect' ? 'Physical' : 'Special',
      );
      let score = 6;
      if (covered) {
        if (context.aiItem === 'Light Clay') score += 1;
        if (rng() < 0.5) score += 1;
      }
      return score;
    }
    if (name === 'Substitute') {
      if (aiPct <= 0.5) return NEVER;
      let score = 6;
      if (context.playerStatus === 'slp') score += 2;
      if (rng() < 0.5) score -= 1;
      return score;
    }
    if (name === 'Trick Room') return faster ? 5 : 10;
    if (name === 'Tailwind') return faster ? 5 : 9;
    if (TERRAIN.has(name)) return context.aiItem === 'Terrain Extender' ? 9 : 8;
    if (name === 'Fake Out') return context.firstTurnOut ? 9 : NEVER;
    if (name === 'Destiny Bond') {
      if (faster && playerKills) return rng() < 0.81 ? 7 : 6;
      return rng() < 0.5 ? 5 : 6;
    }
    if (name === 'Encore') {
      if (context.firstTurnOut) return NEVER;
      return faster ? 7 : rng() < 0.5 ? 6 : 5;
    }
    if (name === 'Counter' || name === 'Mirror Coat') {
      const split = name === 'Counter' ? 'Physical' : 'Special';
      if (playerKills) return NEVER;
      let score = 6;
      const onlySplit =
        playerMoveCategories.includes(split) &&
        playerMoveCategories.every(
          (category) => category === split || category === 'Status',
        );
      if (onlySplit && rng() < 0.8) score += 2;
      if (faster && rng() < 0.25) score -= 1;
      if (playerMoveCategories.includes('Status') && rng() < 0.25) score -= 1;
      return score;
    }
    // The doc's default for non-attacking moves.
    return 6;
  };

  const scores = new Map<string, number>();
  for (const move of moves) {
    scores.set(
      move.name,
      move.category === 'Status' ? statusScore(move) : damagingScore(move),
    );
  }
  return scores;
}

export interface SwitchInCandidate {
  id: string;
  hp: number;
  faster: boolean;
  /** Highest damage this candidate can deal to the player's Pokémon. */
  maxDamageDealt: number;
  /** Highest damage the player's Pokémon can deal to this candidate. */
  maxDamageTaken: number;
  /** Its strongest move against the player's Pokémon. */
  bestMove?: { name: string; minDamage: number; killChance: number };
  /** The player's strongest move against this candidate. */
  bestTaken?: { name: string };
}

export interface RankedSwitchIn {
  id: string;
  reason: string;
}

/**
 * Orders the AI's remaining Pokémon for a post-KO switch-in, best first.
 * The doc doesn't spell out the post-KO routine, so this follows the usual
 * game logic: a faster mon that KOs, then a mon that survives a hit and KOs,
 * then any mon that survives, then the rest. Ties break on damage traded,
 * then party order.
 */
export function rankSwitchIns(
  candidates: readonly SwitchInCandidate[],
  playerHp: number,
): RankedSwitchIn[] {
  const tier = (candidate: SwitchInCandidate): number => {
    const kills = candidate.maxDamageDealt >= playerHp;
    const survives = candidate.maxDamageTaken < candidate.hp;
    if (kills && candidate.faster) return 0;
    if (kills && survives) return 1;
    return survives ? 2 : 3;
  };
  const trade = (candidate: SwitchInCandidate): number =>
    Math.min(candidate.maxDamageDealt / Math.max(playerHp, 1), 1) -
    Math.min(candidate.maxDamageTaken / Math.max(candidate.hp, 1), 1);
  const percent = (damage: number) =>
    Math.round((damage / Math.max(playerHp, 1)) * 100);
  const reason = (candidate: SwitchInCandidate): string => {
    const parts: string[] = [];
    const move = candidate.bestMove;
    if (move) {
      parts.push(
        `${move.name} does ${percent(move.minDamage)}-${percent(candidate.maxDamageDealt)}% to your Pokémon` +
          (move.killChance > 0
            ? ` (${Math.round(move.killChance * 100)}% to KO)`
            : ''),
      );
    }
    parts.push(candidate.faster ? 'it outspeeds you' : 'it is slower than you');
    const takenText = `${candidate.bestTaken?.name ?? 'your best hit'} does up to ${candidate.maxDamageTaken} of its ${candidate.hp} HP`;
    parts.push(
      candidate.maxDamageTaken < candidate.hp
        ? `it survives (${takenText})`
        : `it would not survive (${takenText})`,
    );
    return parts.join(', ');
  };

  return candidates
    .map((candidate, order) => ({ candidate, order }))
    .sort(
      (left, right) =>
        tier(left.candidate) - tier(right.candidate) ||
        trade(right.candidate) - trade(left.candidate) ||
        left.order - right.order,
    )
    .map(({ candidate }) => ({ id: candidate.id, reason: reason(candidate) }));
}

const TRIALS = 2000;

/** Chance the AI clicks each move this turn, most likely first. */
export function predictRunAndBunAi(
  context: RunAndBunAiContext,
  trials = TRIALS,
): AiMovePrediction[] {
  if (context.moves.length === 0) return [];
  const rng = mulberry32(0x5eed);
  const wins = new Map<string, number>();

  for (let trial = 0; trial < trials; trial++) {
    const scores = scoreMoves(context, rng);
    const best = Math.max(...scores.values());
    const tied = [...scores].filter(([, score]) => score === best);
    const [name] = tied[Math.floor(rng() * tied.length)];
    wins.set(name, (wins.get(name) ?? 0) + 1);
  }

  return context.moves
    .map((move) => ({
      name: move.name,
      chance: (wins.get(move.name) ?? 0) / trials,
    }))
    .sort((left, right) => right.chance - left.chance);
}
