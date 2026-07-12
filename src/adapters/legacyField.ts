import type {
  BattleField,
  BattleGameType,
  BattleGeneration,
  BattleSideConditions,
  BattleTerrain,
  BattleWeather,
} from 'domain/index';

export interface LegacySideInput {
  spikes?: number;
  steelsurge?: boolean;
  vinelash?: boolean;
  wildfire?: boolean;
  cannonade?: boolean;
  volcalith?: boolean;
  isSR?: boolean;
  isReflect?: boolean;
  isLightScreen?: boolean;
  isProtected?: boolean;
  isSeeded?: boolean;
  isSaltCured?: boolean;
  isForesight?: boolean;
  isTailwind?: boolean;
  isHelpingHand?: boolean;
  isFlowerGift?: boolean;
  isPowerTrick?: boolean;
  isFriendGuard?: boolean;
  isAuroraVeil?: boolean;
  isBattery?: boolean;
  isPowerSpot?: boolean;
  isSteelySpirit?: boolean;
  isSwitching?: 'out' | 'in';
}

export interface LegacyFieldInput {
  gameType: BattleGameType;
  weather?: BattleWeather;
  terrain?: BattleTerrain;
  isMagicRoom?: boolean;
  isWonderRoom?: boolean;
  isGravity?: boolean;
  isAuraBreak?: boolean;
  isFairyAura?: boolean;
  isDarkAura?: boolean;
  isBeadsOfRuin?: boolean;
  isSwordOfRuin?: boolean;
  isTabletsOfRuin?: boolean;
  isVesselOfRuin?: boolean;
  attackerSide: LegacySideInput;
  defenderSide: LegacySideInput;
}

function normalizeFieldSide(side: LegacySideInput): BattleSideConditions {
  return {
    spikes: side.spikes || 0,
    steelsurge: !!side.steelsurge,
    vinelash: !!side.vinelash,
    wildfire: !!side.wildfire,
    cannonade: !!side.cannonade,
    volcalith: !!side.volcalith,
    isSR: !!side.isSR,
    isReflect: !!side.isReflect,
    isLightScreen: !!side.isLightScreen,
    isProtected: !!side.isProtected,
    isSeeded: !!side.isSeeded,
    isSaltCured: !!side.isSaltCured,
    isForesight: !!side.isForesight,
    isTailwind: !!side.isTailwind,
    isHelpingHand: !!side.isHelpingHand,
    isFlowerGift: !!side.isFlowerGift,
    isPowerTrick: !!side.isPowerTrick,
    isFriendGuard: !!side.isFriendGuard,
    isAuroraVeil: !!side.isAuroraVeil,
    isBattery: !!side.isBattery,
    isPowerSpot: !!side.isPowerSpot,
    isSteelySpirit: !!side.isSteelySpirit,
    isSwitching: side.isSwitching,
  };
}

export function mapLegacySideToBattleSide(
  input: LegacySideInput,
): BattleSideConditions {
  return normalizeFieldSide(input);
}

export function mapLegacyFieldToBattleField(
  generation: BattleGeneration,
  input: LegacyFieldInput,
): BattleField {
  return {
    generation,
    gameType: input.gameType,
    weather: input.weather,
    terrain: input.terrain,
    isMagicRoom: !!input.isMagicRoom,
    isWonderRoom: !!input.isWonderRoom,
    isGravity: !!input.isGravity,
    isAuraBreak: !!input.isAuraBreak,
    isFairyAura: !!input.isFairyAura,
    isDarkAura: !!input.isDarkAura,
    isBeadsOfRuin: !!input.isBeadsOfRuin,
    isSwordOfRuin: !!input.isSwordOfRuin,
    isTabletsOfRuin: !!input.isTabletsOfRuin,
    isVesselOfRuin: !!input.isVesselOfRuin,
    attackerSide: normalizeFieldSide(input.attackerSide),
    defenderSide: normalizeFieldSide(input.defenderSide),
  };
}
