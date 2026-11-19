import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { predictRunAndBunGraph } from 'ai/runAndBunGraph';
import AiDecisionGraph from './AiDecisionGraph';

describe('AI decision graph', () => {
  it('shows graph probabilities and a details button', () => {
    const html = renderToStaticMarkup(
      <AiDecisionGraph
        graph={{
          unsupported: [],
          moves: [
            {
              name: 'Tackle',
              chance: 0.5,
              scores: [{ score: 6, probability: 1 }],
              traces: [
                { score: 6, probability: 1, rules: ['Highest damage: +6'] },
              ],
              nodes: [],
              reach: {},
            },
          ],
        }}
      />,
    );
    expect(html).toContain('Graph 50.0%');
    expect(html).toContain('View Tackle AI details');
    expect(html).not.toContain('Score 6: 100.0%');
  });

  it('keeps graph details collapsed until requested', () => {
    const prediction = predictRunAndBunGraph({
      aiHp: 100,
      aiMaxHp: 100,
      aiSpeed: 100,
      playerHp: 100,
      playerMaxHp: 100,
      playerSpeed: 50,
      playerMoveCategories: ['Physical'],
      playerMaxDamage: 10,
      firstTurnOut: false,
      moves: [
        {
          name: 'Tackle',
          category: 'Physical',
          priority: 0,
          damageRolls: [30],
        },
      ],
    });
    const html = renderToStaticMarkup(<AiDecisionGraph graph={prediction} />);

    expect(html).toContain('View Tackle AI details');
    expect(html).not.toContain('Decision graph for Tackle');
  });

  it('explains why graph selection is unavailable', () => {
    const html = renderToStaticMarkup(
      <AiDecisionGraph graph={{ unsupported: ['Baton Pass'], moves: [] }} />,
    );
    expect(html).toContain('AI graph unavailable');
    expect(html).toContain('Baton Pass');
  });
});
