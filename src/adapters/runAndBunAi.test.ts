import { describe, expect, it } from 'vitest';
import { chooseAiSwitchIn, predictAiGraph } from './runAndBunAi';
import { legacyParityFixtures } from './tests/legacyParity.fixtures';

describe('predictAiGraph', () => {
  it('calculates exact move probabilities from the battle context', () => {
    const { input } = legacyParityFixtures.find(
      (item) => item.id === 'gen9-comet-punch',
    )!;
    const graph = predictAiGraph({
      generation: 9,
      ai: input.attacker,
      player: { ...input.defender, currentHp: 0 },
      field: input.field,
      aiHp: input.attacker.currentHp || 100,
      playerHp: 0,
      aiMoves: ['Spark', 'Bug Bite', 'Vise Grip'],
      playerMoves: ['Tackle'],
      firstTurnOut: false,
    });

    expect(graph.unsupported).toEqual([]);
    expect(graph.moves[0]).toMatchObject({ name: 'Vise Grip', chance: 1 });
  });

  it('explains when Berry history makes a move unsupported', () => {
    const { input } = legacyParityFixtures.find(
      (item) => item.id === 'gen9-comet-punch',
    )!;
    const graph = predictAiGraph({
      generation: 9,
      ai: input.attacker,
      player: input.defender,
      field: input.field,
      aiHp: 100,
      playerHp: 100,
      aiMoves: ['Belch', 'Tackle'],
      playerMoves: ['Tackle'],
      firstTurnOut: true,
      aiBerryEaten: 'maybe',
    });

    expect(graph).toEqual({
      moves: [],
      unsupported: ['Belch: Berry may have been eaten'],
    });
  });
});

describe('chooseAiSwitchIn', () => {
  it('uses the candidate max HP when an imported bench Pokémon has zero current HP', () => {
    const fixture = legacyParityFixtures.find(
      (item) => item.id === 'gen2-night-shade',
    )!;
    const candidate = { ...fixture.input.defender, currentHp: 0 };
    const [choice] = chooseAiSwitchIn({
      generation: fixture.input.generation,
      player: fixture.input.attacker,
      playerHp: fixture.input.attacker.currentHp,
      playerMoves: ['Night Shade'],
      field: fixture.input.field,
      candidates: [{ id: 'candidate', combatant: candidate, moves: [] }],
    });

    expect(choice.reason).toContain('it survives');
    expect(choice.reason).toContain('of its 279 HP');
  });
});
