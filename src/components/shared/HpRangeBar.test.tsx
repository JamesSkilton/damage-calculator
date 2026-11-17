import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import HpRangeBar from './HpRangeBar';

describe('HpRangeBar', () => {
  it('renders fixed percentage marks when enabled', () => {
    const markup = renderToStaticMarkup(
      <HpRangeBar
        min={50}
        max={60}
        maxHp={100}
        label="Defender"
        showPercentMarks
      />,
    );

    for (let percent = 0; percent <= 100; percent += 10) {
      expect(markup).toContain(`left:${percent}%">${percent}%</span>`);
      expect(markup).toContain(
        `hp-range-bar-percent-marker position-absolute top-0 h-100" style="left:${percent}%"`,
      );
    }
  });

  it('does not render percentage marks by default', () => {
    const markup = renderToStaticMarkup(
      <HpRangeBar min={50} max={60} maxHp={100} label="Defender" />,
    );

    expect(markup).not.toContain('hp-range-bar-percent-scale');
    expect(markup).not.toContain('hp-range-bar-percent-markers');
  });

  it.each([
    [51, 'green'],
    [50, 'yellow'],
    [21, 'yellow'],
    [20, 'red'],
    [0, 'red'],
  ])('colours %s%% guaranteed HP %s', (hp, color) => {
    const markup = renderToStaticMarkup(
      <HpRangeBar min={hp} max={hp} maxHp={100} label="Defender" useHealthColors />,
    );

    expect(markup).toContain(`hp-range-bar-safe hp-range-bar-health-${color}`);
    expect(markup).not.toContain('hp-range-bar-uncertain');
  });

  it('splits a range across thresholds and marks every possible segment as uncertain', () => {
    const markup = renderToStaticMarkup(
      <HpRangeBar min={15} max={60} maxHp={100} label="Defender" useHealthColors />,
    );

    expect(markup).toContain('hp-range-bar-safe hp-range-bar-health-red" style="width:15%"');
    expect(markup).toContain('hp-range-bar-health-red hp-range-bar-uncertain" style="width:5%"');
    expect(markup).toContain('hp-range-bar-health-yellow hp-range-bar-uncertain" style="width:30%"');
    expect(markup).toContain('hp-range-bar-health-green hp-range-bar-uncertain" style="width:10%"');
  });

  it('keeps healing and residual segments separate from the health colours', () => {
    const markup = renderToStaticMarkup(
      <HpRangeBar
        min={15}
        max={30}
        maxHp={100}
        label="Defender"
        gains={[{ label: 'berry', amount: 5, kind: 'berry' }]}
        losses={[{ label: 'burn', amount: 3, kind: 'burn' }]}
        useHealthColors
      />,
    );

    expect(markup).toContain('hp-range-bar-safe hp-range-bar-health-red" style="width:10%"');
    expect(markup).toContain('hp-range-bar-gain-berry" style="width:5%"');
    expect(markup).toContain('hp-range-bar-loss-burn" style="width:3%"');
  });
});
