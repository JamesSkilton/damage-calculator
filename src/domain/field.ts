import type {
  BattleGameType,
  BattleGeneration,
  BattleSwitchState,
  BattleTerrain,
  BattleWeather,
} from 'domain/shared';

export interface BattleSideConditions {
  spikes: number;
  steelsurge: boolean;
  vinelash: boolean;
  wildfire: boolean;
  cannonade: boolean;
  volcalith: boolean;
  isSR: boolean;
  isReflect: boolean;
  isLightScreen: boolean;
  isProtected: boolean;
  isSeeded: boolean;
  isSaltCured: boolean;
  isForesight: boolean;
  isTailwind: boolean;
  isHelpingHand: boolean;
  isFlowerGift: boolean;
  isPowerTrick: boolean;
  isFriendGuard: boolean;
  isAuroraVeil: boolean;
  isBattery: boolean;
  isPowerSpot: boolean;
  isSteelySpirit: boolean;
  isSwitching?: BattleSwitchState;
}

export interface BattleField {
  generation: BattleGeneration;
  gameType: BattleGameType;
  weather?: BattleWeather;
  terrain?: BattleTerrain;
  isMagicRoom: boolean;
  isWonderRoom: boolean;
  isGravity: boolean;
  isAuraBreak: boolean;
  isFairyAura: boolean;
  isDarkAura: boolean;
  isBeadsOfRuin: boolean;
  isSwordOfRuin: boolean;
  isTabletsOfRuin: boolean;
  isVesselOfRuin: boolean;
  attackerSide: BattleSideConditions;
  defenderSide: BattleSideConditions;
}
