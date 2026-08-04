import { describe, expect, it } from 'vitest';
import {
  createBattleFieldDraft,
  createBattleSideConditions,
  setBattleFieldField,
  setBattleFieldSideCondition,
} from './battleFieldDraft';

describe('battleFieldDraft', () => {
  it('creates legacy-aligned default field and side state', () => {
    const field = createBattleFieldDraft(9);

    expect(field).toEqual({
      generation: 9,
      gameType: 'Singles',
      weather: undefined,
      terrain: undefined,
      isMagicRoom: false,
      isWonderRoom: false,
      isGravity: false,
      isAuraBreak: false,
      isFairyAura: false,
      isDarkAura: false,
      isBeadsOfRuin: false,
      isSwordOfRuin: false,
      isTabletsOfRuin: false,
      isVesselOfRuin: false,
      attackerSide: createBattleSideConditions(),
      defenderSide: createBattleSideConditions(),
    });
  });

  it('updates field toggles immutably', () => {
    const field = createBattleFieldDraft(9);
    const nextField = setBattleFieldField(field, 'weather', 'Sand');
    const nextTerrain = setBattleFieldField(nextField, 'terrain', 'Electric');
    const nextGravity = setBattleFieldField(nextTerrain, 'isGravity', true);

    expect(nextField.weather).toBe('Sand');
    expect(nextTerrain.terrain).toBe('Electric');
    expect(nextGravity.isGravity).toBe(true);
    expect(field.weather).toBeUndefined();
    expect(field.isGravity).toBe(false);
  });

  it('updates side controls immutably', () => {
    const field = createBattleFieldDraft(9);
    const nextField = setBattleFieldSideCondition(
      field,
      'defenderSide',
      'spikes',
      '2',
    );
    const nextSide = setBattleFieldSideCondition(
      nextField,
      'defenderSide',
      'isReflect',
      true,
    );
    const nextSwitch = setBattleFieldSideCondition(
      nextSide,
      'defenderSide',
      'isSwitching',
      'out',
    );

    expect(nextField.defenderSide.spikes).toBe(2);
    expect(nextSide.defenderSide.isReflect).toBe(true);
    expect(nextSwitch.defenderSide.isSwitching).toBe('out');
    expect(field.defenderSide.spikes).toBe(0);
    expect(field.defenderSide.isReflect).toBe(false);
  });
});
