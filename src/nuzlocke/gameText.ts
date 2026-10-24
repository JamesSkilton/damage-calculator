import type { EncounterRates, GameRoute, RouteMethod } from './types';

// One route per line: "Route 1: Pidgey 40%, Rattata 60%". Species and percentages are optional.
// Linked areas that count as one encounter share a route name and add the area after ">":
// "Meteor Falls > 1F1: Zubat 50%, Lunatone".
// A method (Grass, Surfing, Fishing...) goes in brackets; each method has its own linked
// percentages: "Route 119 [Grass]: Zigzagoon 45%, Oddish 55%".
function parseSpawns(text: string): {
  encounters: string[];
  rates?: EncounterRates;
} {
  const encounters: string[] = [];
  const rates: EncounterRates = {};
  for (const entry of text.split(',')) {
    const match = /^(.*?)\s*(\d+(?:\.\d+)?)\s*%$/.exec(entry.trim());
    const species = (match ? match[1] : entry).trim();
    if (!species) continue;
    if (!encounters.includes(species)) encounters.push(species);
    const rate = match ? Number(match[2]) : 0;
    if (rate > 0 && rate <= 100) rates[species] = rate;
  }
  return {
    encounters,
    ...(Object.keys(rates).length > 0 ? { rates } : {}),
  };
}

function formatSpawns(
  encounters: readonly string[],
  rates?: EncounterRates,
): string {
  return encounters
    .map((species) =>
      rates?.[species] ? `${species} ${rates[species]}%` : species,
    )
    .join(', ');
}

function addSpawns(
  target: { encounters: string[]; rates?: EncounterRates },
  spawns: { encounters: string[]; rates?: EncounterRates },
) {
  for (const species of spawns.encounters)
    if (!target.encounters.includes(species)) target.encounters.push(species);
  if (spawns.rates) target.rates = { ...target.rates, ...spawns.rates };
}

function named<T extends { name: string }>(
  list: T[],
  name: string,
  create: () => T,
): T {
  let found = list.find(
    (entry) => entry.name.toLowerCase() === name.toLowerCase(),
  );
  if (!found) {
    found = create();
    list.push(found);
  }
  return found;
}

export function parseRoutesText(
  text: string,
  existing: readonly GameRoute[] = [],
): GameRoute[] {
  const idsByName = new Map(
    existing.map((route) => [route.name.toLowerCase(), route.id]),
  );
  const routes: GameRoute[] = [];
  const byName = new Map<string, GameRoute>();
  for (const line of text
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)) {
    const separator = line.indexOf(':');
    let head = (separator === -1 ? line : line.slice(0, separator)).trim();
    const spawns = parseSpawns(
      separator === -1 ? '' : line.slice(separator + 1),
    );
    const methodMatch = /\[([^\]]*)\]\s*$/.exec(head);
    const methodName = methodMatch?.[1].trim() ?? '';
    if (methodMatch) head = head.slice(0, methodMatch.index).trim();
    const [rawName, ...rawArea] = head.split('>');
    const name = rawName.trim();
    const areaName = rawArea.join('>').trim();
    let route = byName.get(name.toLowerCase());
    if (!route) {
      route = {
        id: idsByName.get(name.toLowerCase()) ?? crypto.randomUUID(),
        name,
        encounters: [],
      };
      byName.set(name.toLowerCase(), route);
      routes.push(route);
    }
    addSpawns(route, { encounters: spawns.encounters });
    // The line's own table: the route, an area, or a method of either.
    let owner: { methods?: RouteMethod[] } & {
      encounters: string[];
      rates?: EncounterRates;
    } = route;
    if (areaName) {
      route.areas ??= [];
      owner = named(route.areas, areaName, () => ({
        name: areaName,
        encounters: [],
      }));
    }
    if (methodName) {
      owner.methods ??= [];
      addSpawns(
        named(owner.methods, methodName, () => ({
          name: methodName,
          encounters: [],
        })),
        spawns,
      );
    } else if (areaName || spawns.rates) {
      addSpawns(owner, spawns);
    }
  }
  return routes;
}

export function routesToText(routes: readonly GameRoute[]): string {
  const line = (
    name: string,
    area: string | undefined,
    method: string | undefined,
    table: { encounters: readonly string[]; rates?: EncounterRates },
  ) => {
    const head = `${name}${area ? ` > ${area}` : ''}${method ? ` [${method}]` : ''}`;
    const spawns = formatSpawns(table.encounters, table.rates);
    return spawns ? `${head}: ${spawns}` : head;
  };
  return routes
    .flatMap((route) => {
      const lines: string[] = [];
      for (const area of route.areas ?? []) {
        if (area.encounters.length > 0 || !area.methods?.length)
          lines.push(line(route.name, area.name, undefined, area));
        for (const method of area.methods ?? [])
          lines.push(line(route.name, area.name, method.name, method));
      }
      for (const method of route.methods ?? [])
        lines.push(line(route.name, undefined, method.name, method));
      if (lines.length > 0) return lines;
      return [line(route.name, undefined, undefined, route)];
    })
    .join('\n');
}
