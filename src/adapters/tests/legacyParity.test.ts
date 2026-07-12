import { describe, expect, it } from 'vitest';
import { normalizeCalcResult } from '@/adapters/calcResult.helpers';
import { legacyParityFixtures } from '@/adapters/tests/legacyParity.fixtures';

describe('legacy parity fixtures', () => {
  it('normalizes each curated legacy snapshot', () => {
    for (const { expected } of legacyParityFixtures) {
      expect(
        normalizeCalcResult({
          damageRange: expected.range,
          koText: expected.koText,
          fullDesc() {
            return expected.summary;
          },
        }),
      ).toEqual({
        range: { min: expected.range[0], max: expected.range[1] },
        rangeText: `${expected.range[0]} - ${expected.range[1]}`,
        koText: expected.koText,
        summary: expected.summary,
      });
    }
  });

  it('keeps the representative fixture set stable', () => {
    expect(
      legacyParityFixtures.map(({ id, title, input, expected }) => ({
        id,
        title,
        generation: input.generation,
        attacker: input.attacker.name,
        defender: input.defender.name,
        move: input.move.name,
        expected,
      })),
    ).toMatchInlineSnapshot(`
      [
        {
          "attacker": "Mew",
          "defender": "Vulpix",
          "expected": {
            "koText": "guaranteed 6HKO",
            "range": [
              50,
              50,
            ],
            "summary": "Lvl 50 Mew Night Shade vs. Vulpix: 50-50 (17.9 - 17.9%) -- guaranteed 6HKO",
          },
          "generation": 2,
          "id": "gen2-night-shade",
          "move": "Night Shade",
          "title": "Gen 1/2 baseline damage",
        },
        {
          "attacker": "Arceus",
          "defender": "Blastoise",
          "expected": {
            "koText": "guaranteed 2HKO",
            "range": [
              194,
              230,
            ],
            "summary": "0 SpA Meadow Plate Arceus Judgment vs. 0 HP / 0 SpD Blastoise: 194-230 (64.8 - 76.9%) -- guaranteed 2HKO",
          },
          "generation": 4,
          "id": "gen4-judgment-plate",
          "move": "Judgment",
          "title": "Gen 3/4 plate modifier",
        },
        {
          "attacker": "Castform",
          "defender": "Bulbasaur",
          "expected": {
            "koText": "guaranteed 3HKO after sandstorm damage",
            "range": [
              77,
              91,
            ],
            "summary": "0 SpA Castform Weather Ball (100 BP Rock) vs. 0 HP / 0 SpD Bulbasaur in Sand: 77-91 (33.3 - 39.3%) -- guaranteed 3HKO after sandstorm damage",
          },
          "generation": 4,
          "id": "gen4-weather-ball-sand",
          "move": "Weather Ball",
          "title": "Weather Ball picks up sandstorm typing",
        },
        {
          "attacker": "Mew",
          "defender": "Skarmory",
          "expected": {
            "koText": "94.6% chance to 3HKO",
            "range": [
              87,
              103,
            ],
            "summary": "0 SpA Mew Sludge Bomb vs. 0 HP / 0 SpD Skarmory: 87-103 (32.1 - 38%) -- 94.6% chance to 3HKO",
          },
          "generation": 9,
          "id": "gen9-ring-target-sludge-bomb",
          "move": "Sludge Bomb",
          "title": "Gen 5+ immunity is negated by Ring Target",
        },
        {
          "attacker": "Mew",
          "defender": "Vulpix",
          "expected": {
            "koText": "guaranteed OHKO",
            "range": [
              273,
              321,
            ],
            "summary": "0 Atk burned Mew Explosion vs. 0 HP / 0 Def Vulpix on a critical hit: 273-321 (125.8 - 147.9%) -- guaranteed OHKO",
          },
          "generation": 6,
          "id": "gen6-crit-explosion",
          "move": "Explosion",
          "title": "Critical hit damage ignores attack drops and Reflect",
        },
        {
          "attacker": "Snorlax",
          "defender": "Chansey",
          "expected": {
            "koText": "",
            "range": [
              0,
              0,
            ],
            "summary": "Snorlax Hyper Beam vs. protected Chansey: 0-0 (0 - 0%)",
          },
          "generation": 9,
          "id": "gen9-protect-hyper-beam",
          "move": "Hyper Beam",
          "title": "Protect blanks the hit",
        },
        {
          "attacker": "Snorlax",
          "defender": "Vulpix",
          "expected": {
            "koText": "guaranteed 2HKO",
            "range": [
              129,
              156,
            ],
            "summary": "0 Atk Snorlax Comet Punch (3 hits) vs. 0 HP / 0 Def Vulpix: 129-156 (59.4 - 71.8%) -- guaranteed 2HKO",
          },
          "generation": 9,
          "id": "gen9-comet-punch",
          "move": "Comet Punch",
          "title": "Multi-hit damage stays stable",
        },
      ]
    `);
  });
});
