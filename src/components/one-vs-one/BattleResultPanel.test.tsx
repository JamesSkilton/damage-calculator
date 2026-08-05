import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import BattleResultPanel from 'components/one-vs-one/BattleResultPanel';
import { legacyParityFixtures } from 'adapters/tests/legacyParity.fixtures';

describe('BattleResultPanel', () => {
  it('renders the calc breakdown cards and battle snapshot', () => {
    const fixture = legacyParityFixtures[0];
    const markup = renderToStaticMarkup(
      <BattleResultPanel
        generationLabel={`Gen ${fixture.input.generation}`}
        field={fixture.input.field}
        attacker={fixture.input.attacker}
        defender={fixture.input.defender}
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
          },
        ]}
      />,
    );

    expect(markup).toContain('Live result');
    expect(markup).toContain('Calc breakdown');
    expect(markup).toContain('Move 1');
    expect(markup).toContain('Night Shade');
    expect(markup).toContain('50 - 50');
    expect(markup).toContain(fixture.expected.summary);
    expect(markup).toContain('guaranteed 6HKO');
    expect(markup).toContain('Attacker');
    expect(markup).toContain('Defender');
    expect(markup).toContain('Gen 2');
  });

  it('renders the empty state when no move results are available', () => {
    const fixture = legacyParityFixtures[0];
    const markup = renderToStaticMarkup(
      <BattleResultPanel
        generationLabel="Gen 2"
        field={fixture.input.field}
        attacker={fixture.input.attacker}
        defender={fixture.input.defender}
        results={[]}
      />,
    );

    expect(markup).toContain('Add a move to see the calculator breakdown.');
    expect(markup).toContain('No results');
  });
});
