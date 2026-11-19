import { unusableDamageMove, type RunAndBunAiContext } from './runAndBunAi';
import {
  graphFor,
  noHighest,
  toView,
  type Facts,
  type Node,
  type ViewNode,
} from './runAndBunRules';

export type { ViewNode } from './runAndBunRules';

type Branch = {
  score: number;
  probability: number;
  trace: string[];
  halted: boolean;
};
type Visit = (key: string, probability: number) => void;

export interface GraphMovePrediction {
  name: string;
  chance: number;
  scores: { score: number; probability: number }[];
  traces: { score: number; probability: number; rules: string[] }[];
  /** The move's rule graph, for drawing. */
  nodes: ViewNode[];
  /**
   * Probability of reaching each node, plus `id:yes` / `id:no` for conditions
   * and `id:0`, `id:1`... for chance branches.
   */
  reach: Record<string, number>;
}
export type GraphPrediction =
  | { moves: GraphMovePrediction[]; unsupported: [] }
  | { moves: []; unsupported: string[] };

function evaluate(
  nodes: Node[],
  facts: Facts,
  branches: Branch[],
  path: string,
  visit: Visit,
): Branch[] {
  nodes.forEach((node, index) => {
    const id = `${path}/${index}`;
    branches = branches.flatMap((branch): Branch[] => {
      if (branch.halted) return [branch];
      visit(id, branch.probability);
      if (node.kind === 'add')
        return [
          {
            ...branch,
            score: branch.score + node.score,
            trace: [
              ...branch.trace,
              `${node.reason}: ${node.score >= 0 ? '+' : ''}${node.score}`,
            ],
          },
        ];
      if (node.kind === 'never')
        return [
          {
            ...branch,
            score: -20,
            halted: true,
            trace: [...branch.trace, `${node.reason}: never (-20)`],
          },
        ];
      if (node.kind === 'condition') {
        const taken = node.test(facts);
        visit(`${id}:${taken ? 'yes' : 'no'}`, branch.probability);
        return evaluate(
          taken ? node.yes : node.no,
          facts,
          [branch],
          `${id}:${taken ? 'y' : 'n'}`,
          visit,
        );
      }
      return node.branches.flatMap(({ probability, nodes: child }, k) => {
        visit(`${id}:${k}`, branch.probability * probability);
        return evaluate(
          child,
          facts,
          [{ ...branch, probability: branch.probability * probability }],
          `${id}:${k}`,
          visit,
        );
      });
    });
  });
  return branches;
}

/** Exact singles prediction. Unsupported moves prevent a misleading partial selection probability. */
export function predictRunAndBunGraph(
  context: RunAndBunAiContext,
): GraphPrediction {
  if (!context.moves.length) return { moves: [], unsupported: [] };
  if (
    context.aiBerryEaten === 'maybe' &&
    context.moves.some((move) => move.name === 'Belch')
  )
    return { moves: [], unsupported: ['Belch: Berry may have been eaten'] };
  if (
    context.aiHp <= 0 ||
    context.aiMaxHp <= 0 ||
    context.playerHp <= 0 ||
    context.playerMaxHp <= 0
  ) {
    return { moves: [], unsupported: ['missing battle HP'] };
  }
  const graphs = context.moves.map(graphFor);
  const unsupported = context.moves
    .filter(
      (move, i) =>
        !graphs[i] ||
        (context.aiAbility === 'Contrary' &&
          ['Overheat', 'Leaf Storm', 'Superpower'].includes(move.name)) ||
        (move.category !== 'Status' && move.damageRolls.length === 0),
    )
    .map((move) => move.name);
  if (unsupported.length) return { moves: [], unsupported };

  const buckets = new Map<
    string,
    { highest: boolean[]; kills: boolean[]; probability: number }
  >();
  const rolls = new Array<number>(context.moves.length).fill(0);
  const enumerate = (index: number, probability: number) => {
    if (index < context.moves.length) {
      const move = context.moves[index];
      if (move.category === 'Status') {
        enumerate(index + 1, probability);
        return;
      }
      const counts = new Map<number, number>();
      for (const roll of move.damageRolls)
        counts.set(roll, (counts.get(roll) ?? 0) + 1);
      for (const [roll, count] of counts) {
        rolls[index] = roll;
        enumerate(index + 1, (probability * count) / move.damageRolls.length);
      }
      return;
    }
    const eligible = context.moves.map(
      (move, i) =>
        move.category !== 'Status' &&
        !unusableDamageMove(move, context) &&
        !noHighest.has(move.name) &&
        rolls[i] > 0,
    );
    const kills = context.moves.map(
      (move, i) =>
        move.category !== 'Status' &&
        rolls[i] >= context.playerHp &&
        rolls[i] > 0,
    );
    const anyKill = eligible.some((value, i) => value && kills[i]);
    const top = Math.max(
      0,
      ...rolls.map((roll, i) => (eligible[i] ? roll : 0)),
    );
    const highest = eligible.map(
      (value, i) => value && (anyKill ? kills[i] : rolls[i] === top),
    );
    const key = `${highest.map(Number).join('')}:${kills.map(Number).join('')}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.probability += probability;
    else buckets.set(key, { highest, kills, probability });
  };
  enumerate(0, 1);

  const results = context.moves.map((move) => ({
    name: move.name,
    chance: 0,
    scores: new Map<number, number>(),
    traces: new Map<
      string,
      { score: number; probability: number; rules: string[] }
    >(),
    reach: {} as Record<string, number>,
  }));
  for (const bucket of buckets.values()) {
    const distributions = context.moves.map((move, i) => {
      const branches = evaluate(
        graphs[i]!,
        { context, move, highest: bucket.highest[i], kills: bucket.kills[i] },
        [{ score: 0, probability: 1, trace: [], halted: false }],
        '',
        (key, probability) => {
          results[i].reach[key] =
            (results[i].reach[key] ?? 0) + probability * bucket.probability;
        },
      );
      const distribution = new Map<number, number>();
      for (const branch of branches) {
        distribution.set(
          branch.score,
          (distribution.get(branch.score) ?? 0) + branch.probability,
        );
        const weight = branch.probability * bucket.probability;
        results[i].scores.set(
          branch.score,
          (results[i].scores.get(branch.score) ?? 0) + weight,
        );
        const key = JSON.stringify([branch.score, branch.trace]);
        const trace = results[i].traces.get(key);
        if (trace) trace.probability += weight;
        else
          results[i].traces.set(key, {
            score: branch.score,
            probability: weight,
            rules: branch.trace,
          });
      }
      return distribution;
    });
    for (let i = 0; i < distributions.length; i++) {
      for (const [score, probability] of distributions[i]) {
        let ties = [1];
        for (let j = 0; j < distributions.length; j++) {
          if (i === j) continue;
          let less = 0,
            equal = 0;
          for (const [other, p] of distributions[j]) {
            if (other < score) less += p;
            else if (other === score) equal += p;
          }
          const next = new Array<number>(ties.length + 1).fill(0);
          ties.forEach((p, count) => {
            next[count] += p * less;
            next[count + 1] += p * equal;
          });
          ties = next;
        }
        results[i].chance +=
          bucket.probability *
          probability *
          ties.reduce((sum, p, count) => sum + p / (count + 1), 0);
      }
    }
  }
  return {
    unsupported: [],
    moves: results
      .map((result, i) => ({
        name: result.name,
        chance: result.chance,
        scores: [...result.scores]
          .map(([score, probability]) => ({ score, probability }))
          .sort((a, b) => a.score - b.score),
        traces: [...result.traces.values()],
        nodes: toView(graphs[i]!),
        reach: result.reach,
      }))
      .sort((a, b) => b.chance - a.chance),
  };
}
