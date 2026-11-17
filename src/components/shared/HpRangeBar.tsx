import './HpRangeBar.scss';

export type HpRangeBarLoss = {
  label: string;
  amount: number;
  /** Suffix of the `hp-range-bar-loss-*` modifier class that sets the colour. */
  kind: string;
};

export type HpRangeBarGain = HpRangeBarLoss & {
  maxAmount?: number;
};

type HpRangeBarProps = {
  min: number;
  max: number;
  maxHp: number;
  label: string;
  /** Damage dealt after this HP range (status, weather), drawn after the remaining HP. */
  losses?: readonly HpRangeBarLoss[];
  /** Guaranteed healing already included in the range, drawn as its own segment. */
  gains?: readonly HpRangeBarGain[];
  /** Show the HP value at each segment boundary under the bar. */
  showScale?: boolean;
  /** Show fixed percentage marks along the bar. */
  showPercentMarks?: boolean;
  /** Colour HP by its percentage while distinguishing the possible range. */
  useHealthColors?: boolean;
};

const RED_HP_THRESHOLD = 20;
const YELLOW_HP_THRESHOLD = 50;
const PERCENT_MARKS = Array.from({ length: 11 }, (_, index) => index * 10);

function healthColor(percent: number): 'red' | 'yellow' | 'green' {
  if (percent <= RED_HP_THRESHOLD) return 'red';
  if (percent <= YELLOW_HP_THRESHOLD) return 'yellow';
  return 'green';
}

export default function HpRangeBar({
  min,
  max,
  maxHp,
  label,
  losses = [],
  gains = [],
  showScale = false,
  showPercentMarks = false,
  useHealthColors = false,
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
  const rangeSegments = [
    { start: 0, end: RED_HP_THRESHOLD },
    { start: RED_HP_THRESHOLD, end: YELLOW_HP_THRESHOLD },
    { start: YELLOW_HP_THRESHOLD, end: 100 },
  ].map(({ start, end }) => ({
    color: healthColor(end),
    width: Math.max(0, Math.min(possiblePercent, end) - Math.max(guaranteedPercent, start)),
  })).filter((segment) => segment.width > 0);

  // HP value and name at the end of each segment, so the bar can be read off numerically.
  const ticks: { percent: number; text: string; name: string }[] = [];
  const addTick = (percent: number, name: string) => {
    const clamped = Math.min(100, Math.max(0, percent));
    const last = ticks[ticks.length - 1];
    if (clamped <= 0 || (last && clamped - last.percent < 12)) return;
    ticks.push({ percent: clamped, text: String(Math.round((clamped / 100) * maxHp)), name });
  };
  let cursor = safeWidth;
  addTick(cursor, gainSegments.some(({ width }) => width > 0) ? 'before healing' : 'min HP');
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
      aria-label={`${label} left with ${min} to ${max} of ${maxHp} HP${gains.map((gain) => `, ${gain.label} healed ${gain.amount === (gain.maxAmount ?? gain.amount) ? gain.amount : `${gain.amount} to ${gain.maxAmount}`} HP`).join('')}${losses.map((loss) => `, lost ${loss.amount} to ${loss.label}`).join('')}`}
    >
      <div
        className={`hp-range-bar-segment hp-range-bar-safe${useHealthColors ? ` hp-range-bar-health-${healthColor(guaranteedPercent)}` : ''}`}
        style={{ width: `${safeWidth}%` }}
      />
      {gainSegments.map(({ gain, width }, index) => (
        <div
          key={`${gain.label}-${index}`}
          className={`hp-range-bar-segment hp-range-bar-gain-${gain.kind}`}
          style={{ width: `${width}%` }}
          title={`${gain.label}: +${gain.amount}${gain.maxAmount !== undefined && gain.maxAmount !== gain.amount ? `-${gain.maxAmount}` : ''} HP`}
        />
      ))}
      {useHealthColors ? rangeSegments.map((segment) => (
        <div
          key={segment.color}
          className={`hp-range-bar-segment hp-range-bar-swing hp-range-bar-health-${segment.color} hp-range-bar-uncertain`}
          style={{ width: `${segment.width}%` }}
        />
      )) : (
        <div
          className="hp-range-bar-segment hp-range-bar-swing"
          style={{ width: `${Math.max(0, possiblePercent - guaranteedPercent)}%` }}
        />
      )}
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

  if (!showScale && !showPercentMarks) return bar;

  return (
    <div className="hp-range-bar-scaled">
      {showPercentMarks && (
        <div className="hp-range-bar-percent-scale position-relative small text-secondary" aria-hidden="true">
          {PERCENT_MARKS.map((percent) => (
            <span
              key={percent}
              className="hp-range-bar-percent-tick position-absolute"
              style={{ left: `${percent}%` }}
            >
              {percent}%
            </span>
          ))}
        </div>
      )}
      <div className="hp-range-bar-track position-relative">
        {bar}
        {showPercentMarks && (
          <div className="hp-range-bar-percent-markers position-absolute top-0 start-0 w-100 h-100" aria-hidden="true">
            {PERCENT_MARKS.map((percent) => (
              <span
                key={percent}
                className="hp-range-bar-percent-marker position-absolute top-0 h-100"
                style={{ left: `${percent}%` }}
              />
            ))}
          </div>
        )}
      </div>
      {showScale && (
        <div className="hp-range-bar-scale position-relative small text-secondary" aria-hidden="true">
          {ticks.map((tick) => (
            <span key={tick.percent} className="hp-range-bar-tick position-absolute" style={{ left: `${tick.percent}%` }}>
              {tick.text}
              <span className="d-block text-body-tertiary">{tick.name}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
