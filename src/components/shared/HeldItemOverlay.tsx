import type { BattlePlanItemState } from 'domain/battlePlan';

const BERRY_SPRITES = import.meta.glob<string>('../../assets/berries/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
});

function getBerrySprite(item: string): string | undefined {
  const slug = item.toLowerCase().replace(/[^a-z]/g, '');
  return BERRY_SPRITES[`../../assets/berries/${slug}.png`];
}

const STATE_LABEL: Record<BattlePlanItemState, string> = {
  held: 'held',
  'maybe-consumed': 'may be used',
  consumed: 'used',
};

/** Small round item icon meant to sit over the bottom-right corner of a Pokémon sprite. */
export default function HeldItemOverlay({ item, state }: { item: string; state: BattlePlanItemState }) {
  const sprite = getBerrySprite(item);
  const used = state === 'consumed';
  const border = state === 'maybe-consumed' ? 'border border-2 border-warning' : used ? 'border border-2 border-secondary' : '';
  return (
    <span
      className={`position-absolute bottom-0 end-0 d-flex align-items-center justify-content-center rounded-circle bg-white shadow-sm ${border}`}
      style={{ width: '1.5rem', height: '1.5rem' }}
      title={`${item}: ${STATE_LABEL[state]}`}
    >
      {sprite ? (
        <img src={sprite} alt={item} width={20} height={20} className={used ? 'opacity-25' : undefined} />
      ) : (
        <span className={`small fw-bold ${used ? 'text-secondary opacity-50' : ''}`} aria-label={item}>{item[0]}</span>
      )}
      {used && (
        <span className="position-absolute top-50 start-50 w-100 border-top border-danger border-2" style={{ transform: 'translate(-50%, -50%) rotate(-45deg)' }} />
      )}
    </span>
  );
}
