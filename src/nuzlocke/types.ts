export const ENCOUNTER_STATUSES = [
  'pending',
  'caught',
  'missed',
  'dead',
  'skipped',
] as const;
export type EncounterStatus = (typeof ENCOUNTER_STATUSES)[number];

export const MAX_TITLE_LENGTH = 80;
export const MAX_ROUTES = 300;
export const MAX_ROUTE_ENCOUNTERS = 100;
export const MAX_BOX_SETS = 1000;
export const MAX_GAMES = 100;
export const MAX_RUNS = 100;

export interface GameRoute {
  id: string;
  name: string;
  // Species that can be found on this route; empty means any species.
  encounters: string[];
}

export interface NuzlockeGame {
  id: string;
  name: string;
  generation: number;
  routes: GameRoute[];
}

export interface RunEncounter {
  id: string;
  route: string;
  species?: string;
  nickname?: string;
  status: EncounterStatus;
  // Species that can appear here, copied from the game so the run stays self-contained.
  options?: string[];
}

export interface RunBoxSet {
  id: string;
  species: string;
  [field: string]: unknown;
}

export interface NuzlockeRun {
  id: string;
  title: string;
  gameId?: string;
  gameName: string;
  generation: number;
  encounters: RunEncounter[];
  box: RunBoxSet[];
  partyIds: string[];
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export interface NuzlockeRunSummary {
  id: string;
  title: string;
  gameName: string;
  generation: number;
  caught: number;
  dead: number;
  encounterCount: number;
  updatedAt: string;
}

export interface NuzlockeOverview {
  role: 'owner' | 'reader';
  games: NuzlockeGame[];
  runs: NuzlockeRunSummary[];
}

export type GameInput = Pick<NuzlockeGame, 'name' | 'generation' | 'routes'>;

export interface RunPatch {
  title?: string;
  encounters?: RunEncounter[];
  box?: RunBoxSet[];
  partyIds?: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cleanText(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  return text.length > 0 && text.length <= max ? text : undefined;
}

export function createId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function validateTitle(value: unknown): {
  title?: string;
  message?: string;
} {
  const title = cleanText(value, MAX_TITLE_LENGTH);
  return title
    ? { title }
    : { message: `Name is required (max ${MAX_TITLE_LENGTH} characters).` };
}

export function validateGeneration(value: unknown): number | undefined {
  return typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 9
    ? value
    : undefined;
}

export function validateRoutes(value: unknown): {
  routes?: GameRoute[];
  messages: string[];
} {
  if (!Array.isArray(value)) return { messages: ['routes must be an array.'] };
  if (value.length > MAX_ROUTES)
    return { messages: [`At most ${MAX_ROUTES} routes are allowed.`] };
  const routes: GameRoute[] = [];
  const names = new Set<string>();
  for (const [index, entry] of value.entries()) {
    const label = `Route ${index + 1}`;
    if (!isRecord(entry)) return { messages: [`${label} must be an object.`] };
    const name = cleanText(entry.name, MAX_TITLE_LENGTH);
    if (!name)
      return {
        messages: [
          `${label} needs a name (max ${MAX_TITLE_LENGTH} characters).`,
        ],
      };
    if (names.has(name.toLowerCase()))
      return { messages: [`Route "${name}" appears twice.`] };
    names.add(name.toLowerCase());
    const rawEncounters = entry.encounters ?? [];
    if (
      !Array.isArray(rawEncounters) ||
      rawEncounters.length > MAX_ROUTE_ENCOUNTERS
    ) {
      return {
        messages: [
          `${label} encounters must be a list of at most ${MAX_ROUTE_ENCOUNTERS} species.`,
        ],
      };
    }
    const encounters: string[] = [];
    for (const species of rawEncounters) {
      const clean = cleanText(species, 100);
      if (!clean) return { messages: [`${label} has an invalid species.`] };
      if (!encounters.includes(clean)) encounters.push(clean);
    }
    routes.push({
      id: cleanText(entry.id, 64) ?? createId(),
      name,
      encounters,
    });
  }
  return { routes, messages: [] };
}

function optionalText(
  value: unknown,
  max: number,
): { value?: string; valid: boolean } {
  if (value === undefined || value === null || value === '')
    return { valid: true };
  const text = cleanText(value, max);
  return { value: text, valid: text !== undefined };
}

function validateSpeciesList(value: unknown): string[] | undefined {
  if (!Array.isArray(value) || value.length > MAX_ROUTE_ENCOUNTERS)
    return undefined;
  const list: string[] = [];
  for (const species of value) {
    const clean = cleanText(species, 100);
    if (!clean) return undefined;
    if (!list.includes(clean)) list.push(clean);
  }
  return list;
}

export function validateEncounters(value: unknown): {
  encounters?: RunEncounter[];
  messages: string[];
} {
  if (!Array.isArray(value))
    return { messages: ['encounters must be an array.'] };
  if (value.length > MAX_ROUTES)
    return { messages: [`At most ${MAX_ROUTES} encounters are allowed.`] };
  const encounters: RunEncounter[] = [];
  const ids = new Set<string>();
  for (const [index, entry] of value.entries()) {
    const label = `Encounter ${index + 1}`;
    if (!isRecord(entry)) return { messages: [`${label} must be an object.`] };
    const route = cleanText(entry.route, MAX_TITLE_LENGTH);
    if (!route)
      return {
        messages: [
          `${label} needs a route name (max ${MAX_TITLE_LENGTH} characters).`,
        ],
      };
    const status = ENCOUNTER_STATUSES.find(
      (candidate) => candidate === entry.status,
    );
    if (!status) return { messages: [`${label} has an invalid status.`] };
    const species = optionalText(entry.species, 100);
    if (!species.valid)
      return { messages: [`${label} has an invalid species.`] };
    const nickname = optionalText(entry.nickname, 40);
    if (!nickname.valid)
      return { messages: [`${label} has an invalid nickname.`] };
    if ((status === 'caught' || status === 'dead') && !species.value) {
      return { messages: [`${label} needs a species to be marked ${status}.`] };
    }
    const options =
      entry.options === undefined ? [] : validateSpeciesList(entry.options);
    if (!options)
      return { messages: [`${label} has invalid species options.`] };
    const id = cleanText(entry.id, 64) ?? createId();
    if (ids.has(id)) return { messages: [`${label} has a duplicate id.`] };
    ids.add(id);
    encounters.push({
      id,
      route,
      species: species.value,
      nickname: nickname.value,
      status,
      ...(options.length > 0 ? { options } : {}),
    });
  }
  return { encounters, messages: [] };
}

export function validateBox(value: unknown): {
  box?: RunBoxSet[];
  messages: string[];
} {
  if (!Array.isArray(value)) return { messages: ['box must be an array.'] };
  if (value.length > MAX_BOX_SETS)
    return { messages: [`At most ${MAX_BOX_SETS} box Pokémon are allowed.`] };
  for (const entry of value) {
    if (
      !isRecord(entry) ||
      typeof entry.id !== 'string' ||
      typeof entry.species !== 'string'
    ) {
      return { messages: ['Each box Pokémon needs an id and a species.'] };
    }
  }
  return { box: value as RunBoxSet[], messages: [] };
}

export function validatePartyIds(value: unknown): {
  partyIds?: string[];
  messages: string[];
} {
  if (
    !Array.isArray(value) ||
    value.length > 6 ||
    value.some((id) => typeof id !== 'string')
  ) {
    return { messages: ['partyIds must be a list of at most 6 ids.'] };
  }
  return { partyIds: value as string[], messages: [] };
}

export function encountersForGame(
  game: Pick<NuzlockeGame, 'routes'>,
): RunEncounter[] {
  return game.routes.map((route) => ({
    id: createId(),
    route: route.name,
    status: 'pending',
    ...(route.encounters.length > 0 ? { options: route.encounters } : {}),
  }));
}

export function summarizeEncounters(encounters: readonly RunEncounter[]) {
  return {
    // A dead Pokémon was caught first.
    caught: encounters.filter(
      (encounter) =>
        encounter.status === 'caught' || encounter.status === 'dead',
    ).length,
    dead: encounters.filter((encounter) => encounter.status === 'dead').length,
  };
}
