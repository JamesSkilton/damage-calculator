import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import BattleResultPanel from 'components/one-vs-one/BattleResultPanel';
import { legacyParityFixtures } from 'adapters/tests/legacyParity.fixtures';
import { createMoveDraft } from 'components/combatant/moves/moveDraft';
import type { MoveOption } from 'components/combatant/moves/moveOptions';

const noop = () => {};

describe('BattleResultPanel', () => {
  it('renders the attacker → move → damage → defender calculation row', () => {
    const fixture = legacyParityFixtures[0];
    const availableMoves: MoveOption[] = [
      { name: 'Night Shade', type: 'Ghost', basePower: 0, category: 'Special' },
    ];

    const markup = renderToStaticMarkup(
      <BattleResultPanel
        attacker={fixture.input.attacker}
        defender={fixture.input.defender}
        moves={[createMoveDraft('Night Shade')]}
        availableMoves={availableMoves}
        availableSpecies={[]}
        onAttackerChange={noop}
        onDefenderChange={noop}
        onMoveNameChange={noop}
        onSwapSides={noop}
        results={[
          {
            slotIndex: 0,
            label: 'Night Shade',
            result: {
              range: {
                min: fixture.expected.range[0],
                max: fixture.expected.range[1],
              },
              rangeText: `${fixture.expected.range[0]} - ${fixture.expected.range[1]}`,
              koText: fixture.expected.koText,
              summary: fixture.expected.summary,
            },
            details: {
              percentRange: { min: 17.9, max: 17.9 },
              averageDamage: 50,
              averagePercent: 17.9,
              possibleDamage: [50],
              allDamageRolls: [50],
              damageRollFrequency: [{ damage: 50, count: 1 }],
              defenderMaxHp: 279,
              defenderCurrentHp: 279,
              koBreakdown: [
                { hits: 1, label: 'OHKO', chance: 0 },
                { hits: 2, label: '2HKO', chance: 0 },
                { hits: 3, label: '3HKO', chance: 0 },
                { hits: 4, label: '4HKO', chance: 0 },
              ],
              isCritOhko: false,
            },
          },
        ]}
      />,
    );

    expect(markup).toContain('Attacker');
    expect(markup).toContain('Defender');
    expect(markup).toContain('Night Shade');
    expect(markup).toContain('50 - 50');
    expect(markup).toContain('17.9%');
    expect(markup).toContain('4HKO');
    expect(markup).toContain('Avg');
    expect(markup).toContain('Crit OHKO');
    expect(markup).toContain('Crit');
    expect(markup).toContain('Swap sides');
    expect(markup).toContain('calc-attack-row');
    expect(markup).not.toContain(fixture.expected.summary);
  });

  it('renders the empty state when no move results are available', () => {
    const fixture = legacyParityFixtures[0];
    const markup = renderToStaticMarkup(
      <BattleResultPanel
        attacker={fixture.input.attacker}
        defender={fixture.input.defender}
        moves={[]}
        availableMoves={[]}
        availableSpecies={[]}
        onAttackerChange={noop}
        onDefenderChange={noop}
        onMoveNameChange={noop}
        results={[]}
      />,
    );

    expect(markup).toContain('Add a move to see the calculator breakdown.');
  });
});
