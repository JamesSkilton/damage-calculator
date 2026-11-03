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
};

export default function HpRangeBar({
  min,
  max,
  maxHp,
  label,
  losses = [],
}: HpRangeBarProps) {
  if (maxHp <= 0) {
    return null;
  }

  const guaranteedPercent = Math.min(100, Math.max(0, (min / maxHp) * 100));
  const possiblePercent = Math.min(100, Math.max(0, (max / maxHp) * 100));
  let room = 100 - possiblePercent;

  return (
    <div
      className="hp-range-bar"
      role="img"
      aria-label={`${label} left with ${min} to ${max} of ${maxHp} HP${losses.map((loss) => `, lost ${loss.amount} to ${loss.label}`).join('')}`}
    >
      <div
        className="hp-range-bar-segment hp-range-bar-safe"
        style={{ width: `${guaranteedPercent}%` }}
      />
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
}
