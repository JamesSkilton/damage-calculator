import { describe, expect, it } from 'vitest';
import { type AiMove, type RunAndBunAiContext } from './runAndBunAi';
import { predictRunAndBunGraph } from './runAndBunGraph';

const base: RunAndBunAiContext = {
  aiHp: 100,
  aiMaxHp: 100,
  aiSpeed: 100,
  playerHp: 100,
  playerMaxHp: 100,
  playerSpeed: 50,
  playerMoveCategories: ['Physical'],
  playerMaxDamage: 10,
  firstTurnOut: false,
  moves: [],
};
const attack = (name: string, damageRolls: number[]): AiMove => ({
  name,
  category: 'Physical',
  priority: 0,
  damageRolls,
});
const status = (name: string): AiMove => ({
  name,
  category: 'Status',
  priority: 0,
  damageRolls: [],
});
const result = (context: RunAndBunAiContext) => {
  const prediction = predictRunAndBunGraph(context);
  expect(prediction.unsupported).toEqual([]);
  return prediction.moves;
};

describe('graph AI prediction', () => {
  it('resolves independent damage rolls jointly before scoring', () => {
    const moves = result({
      ...base,
      moves: [attack('Tackle', [10, 20]), attack('Scratch', [15, 25])],
    });
    expect(moves.find((move) => move.name === 'Tackle')?.chance).toBeCloseTo(
      0.25,
    );
    expect(moves.find((move) => move.name === 'Scratch')?.chance).toBeCloseTo(
      0.75,
    );
    expect(moves.find((move) => move.name === 'Tackle')?.scores).toEqual([
      { score: 0, probability: 0.75 },
      { score: 6, probability: 0.2 },
      { score: 8, probability: expect.closeTo(0.05) },
    ]);
  });

  it('splits ties exactly, including equal damage rolls and multiple KOs', () => {
    const moves = result({
      ...base,
      moves: [attack('Tackle', [100]), attack('Scratch', [110])],
    });
    expect(moves[0].chance).toBeCloseTo(0.5);
    expect(moves[1].chance).toBeCloseTo(0.5);
    expect(moves[0].scores.map((entry) => entry.score)).toEqual([12, 14]);
  });

  it('stacks special move and KO scores and exposes the rule trace', () => {
    const [move] = result({ ...base, moves: [attack('Future Sight', [100])] });
    expect(move.scores).toEqual([{ score: 12, probability: 1 }]);
    expect(move.traces[0].rules).toContain('Future Sight: +6');
    expect(move.traces[0].rules).toContain('Fast or priority KO: +6');
  });

  it('stops scoring after a hard exclusion', () => {
    const [move] = result({
      ...base,
      aiSpecies: 'Meloetta-Pirouette',
      moves: [attack('Relic Song', [100])],
    });
    expect(move.scores).toEqual([{ score: -20, probability: 1 }]);
    expect(move.traces[0].rules).toEqual(['Pirouette form: never (-20)']);
  });

  it('combines chance branches and splits selection ties', () => {
    const moves = result({
      ...base,
      firstTurnOut: false,
      moves: [attack('Tackle', [40]), status('Stealth Rock')],
    });
    expect(moves.find((move) => move.name === 'Tackle')?.chance).toBeCloseTo(
      0.3,
    );
    expect(
      moves.find((move) => move.name === 'Stealth Rock')?.chance,
    ).toBeCloseTo(0.7);
  });

  it('records how often each node and branch is reached', () => {
    const [move] = result({
      ...base,
      moves: [attack('Tackle', [10, 20, 100, 100])],
    });
    const highest = move.nodes[0];
    expect(highest.kind).toBe('condition');
    expect(move.reach[highest.id]).toBeCloseTo(1);
    expect(move.reach[`${highest.id}:yes`]).toBeCloseTo(1);
    const kills = move.nodes[1];
    expect(move.reach[`${kills.id}:yes`]).toBeCloseTo(0.5);
    expect(move.reach[`${kills.id}:no`]).toBeCloseTo(0.5);
  });

  it('excludes Belch until a Berry is eaten', () => {
    const moves = [attack('Belch', [90]), attack('Tackle', [30])];
    const before = { ...base, aiBerryEaten: 'no' as const, moves };
    const after = { ...before, aiBerryEaten: 'yes' as const };
    expect(result(before).find((move) => move.name === 'Belch')?.chance).toBe(
      0,
    );
    expect(result(before).find((move) => move.name === 'Tackle')?.chance).toBe(
      1,
    );
    expect(result(after).find((move) => move.name === 'Belch')?.chance).toBe(1);
    expect(
      result(before).find((move) => move.name === 'Belch')?.traces[0].rules,
    ).toContain('Belch fails without an eaten Berry: never (-20)');
    expect(
      predictRunAndBunGraph({ ...before, aiBerryEaten: 'maybe' }).unsupported,
    ).toEqual(['Belch: Berry may have been eaten']);
  });

  it('scores Fake Out on the first turn and respects flinch immunity', () => {
    const moves = [attack('Fake Out', [20]), attack('Tackle', [30])];
    const first = { ...base, firstTurnOut: true, moves };
    const immune = { ...first, playerAbility: 'Inner Focus' };
    const later = { ...first, firstTurnOut: false };
    expect(result(first).find((move) => move.name === 'Fake Out')?.chance).toBe(
      1,
    );
    expect(result(immune).find((move) => move.name === 'Tackle')?.chance).toBe(
      1,
    );
    expect(result(later).find((move) => move.name === 'Fake Out')?.chance).toBe(
      0,
    );
    expect(
      result(first).find((move) => move.name === 'Fake Out')?.traces[0].rules,
    ).toContain('Fake Out: +9');
  });

  it('reports unsupported rules and missing rolls instead of partial probabilities', () => {
    expect(
      predictRunAndBunGraph({
        ...base,
        moves: [attack('Tackle', []), attack('Sucker Punch', [10])],
      }),
    ).toEqual({ moves: [], unsupported: ['Tackle', 'Sucker Punch'] });
    expect(
      predictRunAndBunGraph({
        ...base,
        playerHp: 0,
        moves: [status('Stealth Rock')],
      }),
    ).toEqual({ moves: [], unsupported: ['missing battle HP'] });
  });

  it('handles four sets of sixteen distinct rolls deterministically', () => {
    const moves = Array.from({ length: 4 }, (_, i) =>
      attack(
        `Move ${i}`,
        Array.from({ length: 16 }, (_, roll) => roll + i * 2 + 1),
      ),
    );
    const context = { ...base, moves };
    const first = result(context);
    expect(first.reduce((sum, move) => sum + move.chance, 0)).toBeCloseTo(1);
    expect(result(context)).toEqual(first);
  });
});
