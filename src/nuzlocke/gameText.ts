import type { GameRoute } from './types';

// One route per line: "Route 1: Pidgey, Rattata". The species list is optional.
export function parseRoutesText(
  text: string,
  existing: readonly GameRoute[] = [],
): GameRoute[] {
  const idsByName = new Map(
    existing.map((route) => [route.name.toLowerCase(), route.id]),
  );
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const separator = line.indexOf(':');
      const name = (separator === -1 ? line : line.slice(0, separator)).trim();
      const species =
        separator === -1 ? [] : line.slice(separator + 1).split(',');
      const encounters = [
        ...new Set(species.map((entry) => entry.trim()).filter(Boolean)),
      ];
      return {
        id: idsByName.get(name.toLowerCase()) ?? crypto.randomUUID(),
        name,
        encounters,
      };
    });
}

export function routesToText(routes: readonly GameRoute[]): string {
  return routes
    .map((route) =>
      route.encounters.length > 0
        ? `${route.name}: ${route.encounters.join(', ')}`
        : route.name,
    )
    .join('\n');
}
