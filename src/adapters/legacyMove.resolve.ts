import {
  mergeLegacy,
  toLegacyId,
  type LegacyGeneration,
} from 'adapters/legacyShared';
import { getMaxMoveName, getZMoveName } from 'adapters/legacyMove.names';
import type {
  LegacyMoveData,
  LegacyMoveInput,
} from 'adapters/legacyMove.types';

export function getMoveData(
  generation: LegacyGeneration<unknown, LegacyMoveData>,
  input: LegacyMoveInput,
): LegacyMoveData {
  const move = generation.moves.get(toLegacyId(input.name));

  if (!move) {
    throw new Error(`Unknown move: ${input.name}`);
  }

  return mergeLegacy(move, input.overrides);
}

export function resolveMoveData(
  generation: LegacyGeneration<unknown, LegacyMoveData>,
  input: LegacyMoveInput,
  baseData: LegacyMoveData,
): LegacyMoveData {
  if (input.useMax && baseData.maxMove) {
    const maxMoveName = getMaxMoveName(
      baseData.type,
      baseData.name,
      input.species,
      baseData.category === 'Status',
      input.ability,
    );
    const maxMove = generation.moves.get(toLegacyId(maxMoveName)) as
      LegacyMoveData | undefined;

    if (!maxMove) {
      throw new Error(`Unknown max move: ${maxMoveName}`);
    }

    const maxPower = () => {
      if (
        ['G-Max Drum Solo', 'G-Max Fire Ball', 'G-Max Hydrosnipe'].includes(
          maxMoveName,
        )
      ) {
        return 160;
      }

      if (maxMove.basePower === 10 || maxMoveName === 'Max Flare') {
        return baseData.maxMove!.basePower;
      }

      return maxMove.basePower;
    };

    return {
      ...mergeLegacy(maxMove, input.overrides),
      name: maxMoveName,
      basePower: maxPower(),
      category: baseData.category,
    } as LegacyMoveData;
  }

  if (input.useZ && baseData.zMove?.basePower) {
    const zMoveName = getZMoveName(baseData.name, baseData.type, input.item);
    const zMove = generation.moves.get(toLegacyId(zMoveName)) as
      LegacyMoveData | undefined;

    if (!zMove) {
      throw new Error(`Unknown z-move: ${zMoveName}`);
    }

    return {
      ...mergeLegacy(zMove, input.overrides),
      name: zMoveName,
      basePower:
        zMove.basePower === 1 ? baseData.zMove.basePower : zMove.basePower,
      category: baseData.category,
    } as LegacyMoveData;
  }

  return mergeLegacy(baseData, input.overrides);
}
