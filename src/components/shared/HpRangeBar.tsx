import './HpRangeBar.scss';

export type HpRangeBarLoss = {
  label: string;
  amount: number;
  /** Suffix of the `hp-range-bar-loss-*` modifier class that sets the colour. */
  kind: string;
};

type HpRangeBarProps = {
  min: number;
  max: number;
  maxHp: number;
  label: string;
  /** Damage dealt after this HP range (status, weather), drawn after the remaining HP. */
  losses?: readonly HpRangeBarLoss[];
  /** HP already included in the range that came from a berry, drawn as its own green segment. */
  gains?: readonly HpRangeBarLoss[];
  /** Show the HP value at each segment boundary under the bar. */
  showScale?: boolean;
};

export default function HpRangeBar({
  min,
  max,
  maxHp,
  label,
  losses = [],
  gains = [],
  showScale = false,
}: HpRangeBarProps) {
  if (maxHp <= 0) {
    return null;
  }

  const guaranteedPercent = Math.min(100, Math.max(0, (min / maxHp) * 100));
  const possiblePercent = Math.min(100, Math.max(0, (max / maxHp) * 100));
  let room = 100 - possiblePercent;
  let safeWidth = guaranteedPercent;
  const gainSegments = gains.map((gain) => {
    const width = Math.min(safeWidth, Math.max(0, (gain.amount / maxHp) * 100));
    safeWidth -= width;
    return { gain, width };
  });

  // HP value and name at the end of each segment, so the bar can be read off numerically.
  const ticks: { percent: number; text: string; name: string }[] = [];
  const addTick = (percent: number, name: string) => {
    const clamped = Math.min(100, Math.max(0, percent));
    const last = ticks[ticks.length - 1];
    if (clamped <= 0 || (last && clamped - last.percent < 12)) return;
    ticks.push({ percent: clamped, text: String(Math.round((clamped / 100) * maxHp)), name });
  };
  let cursor = safeWidth;
  addTick(cursor, 'min HP');
  for (const { gain, width } of gainSegments) {
    cursor += width;
    addTick(cursor, gain.label);
  }
  addTick(possiblePercent, 'max HP');
  let lossCursor = possiblePercent;
  for (const loss of losses) {
    lossCursor = Math.min(100, lossCursor + (loss.amount / maxHp) * 100);
    addTick(lossCursor, loss.label);
  }

  const bar = (
    <div
      className="hp-range-bar"
      role="img"
      aria-label={`${label} left with ${min} to ${max} of ${maxHp} HP${gains.map((gain) => `, healed up to ${gain.amount} by ${gain.label}`).join('')}${losses.map((loss) => `, lost ${loss.amount} to ${loss.label}`).join('')}`}
    >
      <div
        className="hp-range-bar-segment hp-range-bar-safe"
        style={{ width: `${safeWidth}%` }}
      />
      {gainSegments.map(({ gain, width }) => (
        <div
          key={gain.label}
          className={`hp-range-bar-segment hp-range-bar-gain-${gain.kind}`}
          style={{ width: `${width}%` }}
          title={`${gain.label}: +${gain.amount} HP`}
        />
      ))}
      <div
        className="hp-range-bar-segment hp-range-bar-swing"
        style={{ width: `${Math.max(0, possiblePercent - guaranteedPercent)}%` }}
      />
      {losses.map((loss) => {
        const width = Math.min(room, Math.max(0, (loss.amount / maxHp) * 100));
        room -= width;
        return (
          <div
            key={loss.label}
            className={`hp-range-bar-segment hp-range-bar-loss-${loss.kind}`}
            style={{ width: `${width}%` }}
            title={`${loss.label}: -${loss.amount} HP`}
          />
        );
      })}
    </div>
  );

  if (!showScale) return bar;

  return (
    <div className="hp-range-bar-scaled">
      {bar}
      <div className="hp-range-bar-scale position-relative small text-secondary" aria-hidden="true">
        {ticks.map((tick) => (
          <span key={tick.percent} className="hp-range-bar-tick position-absolute" style={{ left: `${tick.percent}%` }}>
            {tick.text}
            <span className="d-block text-body-tertiary">{tick.name}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
