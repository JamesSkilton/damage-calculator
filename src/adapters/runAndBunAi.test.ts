import { describe, expect, it } from 'vitest';
import { chooseAiSwitchIn, predictAiMoves } from './runAndBunAi';
import { legacyParityFixtures } from './tests/legacyParity.fixtures';

describe('predictAiMoves', () => {
  it('weights the highest damaging move when the player HP is the 0 "full HP" placeholder', () => {
    const { input } = legacyParityFixtures.find((item) => item.id === 'gen9-comet-punch')!;
    const predictions = predictAiMoves({
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

    expect(predictions[0]).toEqual({ name: 'Vise Grip', chance: 1 });
  });

  it('almost always picks the highest damaging move, with only overlapping rolls picking a weaker one', () => {
    const { input } = legacyParityFixtures.find((item) => item.id === 'gen9-comet-punch')!;
    const ai = { ...input.attacker, species: 'Grubbin', name: 'Grubbin', types: ['Bug'] as const, level: 5 };
    const player = {
      ...input.defender,
      species: 'Surskit',
      name: 'Surskit',
      types: ['Bug', 'Water'] as const,
      level: 5,
      currentHp: 0,
    };
    const predictions = predictAiMoves({
      generation: 9,
      ai,
      player,
      field: input.field,
      aiHp: 17,
      playerHp: 0,
      aiMoves: ['Bug Bite', 'Spark', 'Vise Grip'],
      playerMoves: ['Bubble'],
      firstTurnOut: false,
    });

    expect(predictions[0].name).toBe('Spark');
    expect(predictions[0].chance).toBeGreaterThan(0.95);
    expect(predictions.find((entry) => entry.name === 'Vise Grip')?.chance).toBe(0);
  });
});

describe('chooseAiSwitchIn', () => {
  it('uses the candidate max HP when an imported bench Pokémon has zero current HP', () => {
    const fixture = legacyParityFixtures.find((item) => item.id === 'gen2-night-shade')!;
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
