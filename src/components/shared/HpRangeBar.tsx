import './HpRangeBar.scss';

type HpRangeBarProps = {
  min: number;
  max: number;
  maxHp: number;
  label: string;
};

export default function HpRangeBar({
  min,
  max,
  maxHp,
  label,
}: HpRangeBarProps) {
  if (maxHp <= 0) {
    return null;
  }

  const guaranteedPercent = Math.min(100, Math.max(0, (min / maxHp) * 100));
  const possiblePercent = Math.min(100, Math.max(0, (max / maxHp) * 100));

  return (
    <div
      className="hp-range-bar"
      role="img"
      aria-label={`${label} left with ${min} to ${max} of ${maxHp} HP`}
    >
      <div
        className="hp-range-bar-segment hp-range-bar-safe"
        style={{ width: `${guaranteedPercent}%` }}
      />
      <div
        className="hp-range-bar-segment hp-range-bar-swing"
        style={{ width: `${Math.max(0, possiblePercent - guaranteedPercent)}%` }}
      />
    </div>
  );
}
