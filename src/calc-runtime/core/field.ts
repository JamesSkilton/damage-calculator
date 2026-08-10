import type {State} from './state';
import type {GameType, Weather, Terrain} from './data/interface';

export interface Field extends State.Field {
  gameType: GameType;
  weather?: Weather;
  terrain?: Terrain;
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
  attackerSide: Side;
  defenderSide: Side;
  hasWeather(...weathers: Weather[]): boolean;
  hasTerrain(...terrains: Terrain[]): boolean;
  swap(): this;
  clone(): Field;
}

export interface Side extends State.Side {
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
  isSwitching?: 'out' | 'in';
  clone(): Side;
}

export function Side(side: State.Side = {}): Side {
  const self: Side = {
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
    clone() { return Side(self); },
  };
  return self;
}

export function Field(field: Partial<State.Field> = {}): Field {
  const self: Field = {
    gameType: field.gameType || 'Singles',
    terrain: field.terrain,
    weather: field.weather,
    isMagicRoom: !!field.isMagicRoom,
    isWonderRoom: !!field.isWonderRoom,
    isGravity: !!field.isGravity,
    isAuraBreak: field.isAuraBreak || false,
    isFairyAura: field.isFairyAura || false,
    isDarkAura: field.isDarkAura || false,
    isBeadsOfRuin: field.isBeadsOfRuin || false,
    isSwordOfRuin: field.isSwordOfRuin || false,
    isTabletsOfRuin: field.isTabletsOfRuin || false,
    isVesselOfRuin: field.isVesselOfRuin || false,
    attackerSide: Side(field.attackerSide || {}),
    defenderSide: Side(field.defenderSide || {}),
    hasWeather(...weathers: Weather[]) {
      return !!(self.weather && weathers.includes(self.weather));
    },
    hasTerrain(...terrains: Terrain[]) {
      return !!(self.terrain && terrains.includes(self.terrain));
    },
    swap() {
      [self.attackerSide, self.defenderSide] = [self.defenderSide, self.attackerSide];
      return self;
    },
    clone() {
      return Field({
        gameType: self.gameType,
        weather: self.weather,
        terrain: self.terrain,
        isMagicRoom: self.isMagicRoom,
        isWonderRoom: self.isWonderRoom,
        isGravity: self.isGravity,
        attackerSide: self.attackerSide,
        defenderSide: self.defenderSide,
        isAuraBreak: self.isAuraBreak,
        isDarkAura: self.isDarkAura,
        isFairyAura: self.isFairyAura,
        isBeadsOfRuin: self.isBeadsOfRuin,
        isSwordOfRuin: self.isSwordOfRuin,
        isTabletsOfRuin: self.isTabletsOfRuin,
        isVesselOfRuin: self.isVesselOfRuin,
      });
    },
  };
  return self;
}
