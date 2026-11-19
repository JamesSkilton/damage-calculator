import { describe, expect, it } from 'vitest';
import { rankSwitchIns } from './runAndBunAi';

describe('rankSwitchIns', () => {
  it('prefers a faster KO, then a survivable KO, then the rest', () => {
    const order = rankSwitchIns(
      [
        {
          id: 'weak',
          hp: 50,
          faster: true,
          maxDamageDealt: 10,
          maxDamageTaken: 90,
        },
        {
          id: 'tank',
          hp: 100,
          faster: false,
          maxDamageDealt: 100,
          maxDamageTaken: 40,
        },
        {
          id: 'sweeper',
          hp: 50,
          faster: true,
          maxDamageDealt: 100,
          maxDamageTaken: 90,
        },
      ],
      100,
    );
    expect(order.map((entry) => entry.id)).toEqual(['sweeper', 'tank', 'weak']);
    expect(order[0].reason).toContain('outspeeds');
  });
});
