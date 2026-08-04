import type {
  BattleField,
  BattleGeneration,
  BattleSideConditions,
  BattleSwitchState,
} from 'domain/index';

type BattleFieldEditableKey =
  | 'weather'
  | 'terrain'
  | 'isMagicRoom'
  | 'isWonderRoom'
  | 'isGravity'
  | 'isAuraBreak'
  | 'isFairyAura'
  | 'isDarkAura'
  | 'isBeadsOfRuin'
  | 'isSwordOfRuin'
  | 'isTabletsOfRuin'
  | 'isVesselOfRuin';

type BattleSideEditableKey = keyof BattleSideConditions;

export const battleWeatherOptions = [
  { value: '', label: 'Clear' },
  { value: 'Sun', label: 'Sun' },
  { value: 'Rain', label: 'Rain' },
  { value: 'Sand', label: 'Sand' },
  { value: 'Hail', label: 'Hail' },
  { value: 'Snow', label: 'Snow' },
  { value: 'Harsh Sunshine', label: 'Harsh Sunshine' },
  { value: 'Heavy Rain', label: 'Heavy Rain' },
  { value: 'Strong Winds', label: 'Strong Winds' },
] as const;

export const battleTerrainOptions = [
  { value: '', label: 'No terrain' },
  { value: 'Electric', label: 'Electric' },
  { value: 'Grassy', label: 'Grassy' },
  { value: 'Misty', label: 'Misty' },
  { value: 'Psychic', label: 'Psychic' },
] as const;

const fieldToggleDefaults = {
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
} as const;

export function createBattleSideConditions(): BattleSideConditions {
  return {
    spikes: 0,
    steelsurge: false,
    vinelash: false,
    wildfire: false,
    cannonade: false,
    volcalith: false,
    isSR: false,
    isReflect: false,
    isLightScreen: false,
    isProtected: false,
    isSeeded: false,
    isSaltCured: false,
    isForesight: false,
    isTailwind: false,
    isHelpingHand: false,
    isFlowerGift: false,
    isPowerTrick: false,
    isFriendGuard: false,
    isAuroraVeil: false,
    isBattery: false,
    isPowerSpot: false,
    isSteelySpirit: false,
    isSwitching: undefined,
  };
}

export function createBattleFieldDraft(
  generation: BattleGeneration,
): BattleField {
  return {
    generation,
    gameType: 'Singles',
    ...fieldToggleDefaults,
    attackerSide: createBattleSideConditions(),
    defenderSide: createBattleSideConditions(),
  };
}

export function setBattleFieldField(
  field: BattleField,
  key: BattleFieldEditableKey,
  value: string | boolean | null | undefined,
): BattleField {
  if (key === 'weather' || key === 'terrain') {
    const normalized = typeof value === 'string' ? value.trim() : '';

    return {
      ...field,
      [key]: normalized === '' ? undefined : normalized,
    };
  }

  return {
    ...field,
    [key]: Boolean(value),
  };
}

export function setBattleFieldSideCondition(
  field: BattleField,
  side: 'attackerSide' | 'defenderSide',
  key: BattleSideEditableKey,
  value: string | boolean | null | undefined,
): BattleField {
  if (key === 'spikes') {
    const rawValue = typeof value === 'string' ? value.trim() : value;

    if (rawValue === '') {
      return field;
    }

    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) {
      return field;
    }

    return {
      ...field,
      [side]: {
        ...field[side],
        spikes: Math.max(0, Math.min(3, Math.trunc(parsed))),
      },
    };
  }

  if (key === 'isSwitching') {
    const normalized = typeof value === 'string' ? value.trim() : '';

    return {
      ...field,
      [side]: {
        ...field[side],
        isSwitching:
          normalized === '' ? undefined : (normalized as BattleSwitchState),
      },
    };
  }

  return {
    ...field,
    [side]: {
      ...field[side],
      [key]: Boolean(value),
    },
  };
}

