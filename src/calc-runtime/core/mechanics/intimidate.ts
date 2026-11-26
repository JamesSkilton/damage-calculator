import type { BattleStatBoosts } from 'domain/shared';

export function intimidateBoosts(
  generation: number,
  ability: string | undefined,
  item: string | undefined,
  boosts: BattleStatBoosts,
): BattleStatBoosts {
  if (
    ['Clear Body', 'White Smoke', 'Hyper Cutter', 'Full Metal Body'].includes(
      ability ?? '',
    ) ||
    (generation >= 8 &&
      ['Inner Focus', 'Own Tempo', 'Oblivious', 'Scrappy'].includes(
        ability ?? '',
      )) ||
    item === 'Clear Amulet'
  )
    return { ...boosts };

  const next = { ...boosts };
  if (['Contrary', 'Defiant', 'Guard Dog'].includes(ability ?? '')) {
    next.atk = Math.min(6, (next.atk ?? 0) + 1);
  } else {
    next.atk = Math.max(-6, (next.atk ?? 0) - (ability === 'Simple' ? 2 : 1));
  }
  if (ability === 'Competitive') {
    next.spa = Math.min(6, (next.spa ?? 0) + 2);
  }
  return next;
}
