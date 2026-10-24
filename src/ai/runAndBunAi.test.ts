import { describe, expect, it } from 'vitest';
import { predictRunAndBunAi, rankSwitchIns, type RunAndBunAiContext } from './runAndBunAi';

const rolls = (value: number) => Array.from({ length: 16 }, () => value);

const base: RunAndBunAiContext = {
  aiHp: 100,
  aiMaxHp: 100,
  aiSpeed: 100,
  playerHp: 100,
  playerMaxHp: 100,
  playerSpeed: 50,
  playerMoveCategories: ['Physical'],
  playerMaxDamage: 10,
  firstTurnOut: false,
  moves: [],
};

describe('rankSwitchIns', () => {
  it('prefers a faster KO, then a survivable KO, then the rest', () => {
    const order = rankSwitchIns(
      [
        { id: 'weak', hp: 50, faster: true, maxDamageDealt: 10, maxDamageTaken: 90 },
        { id: 'tank', hp: 100, faster: false, maxDamageDealt: 100, maxDamageTaken: 40 },
        { id: 'sweeper', hp: 50, faster: true, maxDamageDealt: 100, maxDamageTaken: 90 },
      ],
      100,
    );
    expect(order.map((entry) => entry.id)).toEqual(['sweeper', 'tank', 'weak']);
    expect(order[0].reason).toContain('outspeeds');
  });
});

describe('predictRunAndBunAi', () => {
  it('prefers the move that kills when faster', () => {
    const [top] = predictRunAndBunAi({
      ...base,
      moves: [
        { name: 'Flamethrower', category: 'Special', priority: 0, damageRolls: rolls(100) },
        { name: 'Tackle', category: 'Physical', priority: 0, damageRolls: rolls(30) },
        { name: 'Swords Dance', category: 'Status', priority: 0, damageRolls: [] },
      ],
    });
    expect(top).toEqual({ name: 'Flamethrower', chance: 1 });
  });

  it('never sets up when the player can KO it', () => {
    const [top] = predictRunAndBunAi({
      ...base,
      playerMaxDamage: 100,
      moves: [
        { name: 'Tackle', category: 'Physical', priority: 0, damageRolls: rolls(10) },
        { name: 'Swords Dance', category: 'Status', priority: 0, damageRolls: [] },
      ],
    });
    expect(top.name).toBe('Tackle');
  });

  it('uses priority when slower and about to die', () => {
    const [top] = predictRunAndBunAi({
      ...base,
      aiSpeed: 10,
      playerMaxDamage: 100,
      moves: [
        { name: 'Earthquake', category: 'Physical', priority: 0, damageRolls: rolls(60) },
        { name: 'Aqua Jet', category: 'Physical', priority: 1, damageRolls: rolls(20) },
      ],
    });
    expect(top.name).toBe('Aqua Jet');
  });
});
