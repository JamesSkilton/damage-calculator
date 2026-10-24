export const ENCOUNTER_STATUSES = [
  'pending',
  'caught',
  'missed',
  'dead',
  'skipped',
] as const;
export type EncounterStatus = (typeof ENCOUNTER_STATUSES)[number];

export const AI_PROFILES = ['run-and-bun'] as const;
export type AiProfile = (typeof AI_PROFILES)[number];

export const AI_PROFILE_LABELS: Record<AiProfile, string> = {
  'run-and-bun': 'Pokémon Run & Bun (1.07)',
};

export const MAX_TITLE_LENGTH = 80;
export const MAX_ROUTES = 300;
export const MAX_ROUTE_ENCOUNTERS = 100;
export const MAX_ROUTE_AREAS = 30;
export const MAX_ROUTE_METHODS = 12;
export const MAX_BOX_SETS = 1000;
export const MAX_GAMES = 100;
export const MAX_RUNS = 100;

// Encounter chance per species, as a percentage (0-100].
export type EncounterRates = Record<string, number>;

// How the encounter happens (Grass, Surfing, Fishing...). The chances of one method's
// species are linked: together they make up that method's own 100%.
export interface RouteMethod {
  name: string;
  encounters: string[];
  rates?: EncounterRates;
}

// A section of a linked route (e.g. "1F1" of Meteor Falls) with its own spawns.
// `encounters`/`rates` are the area's own table; `methods` are extra tables.
export interface RouteArea {
  name: string;
  encounters: string[];
  rates?: EncounterRates;
  methods?: RouteMethod[];
}

export interface GameRoute {
  id: string;
  name: string;
  // Species that can be found on this route; empty means any species.
  // For routes with areas or methods this is the union of all of their species.
  encounters: string[];
  rates?: EncounterRates;
  // Linked sub-areas that together count as a single encounter.
  areas?: RouteArea[];
  // Methods that apply to the route as a whole.
  methods?: RouteMethod[];
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
  rates?: EncounterRates;
  areas?: RouteArea[];
  methods?: RouteMethod[];
  // The linked area / method the player is currently in; options narrow to it.
  area?: string;
  method?: string;
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
  // Opponent AI used by the battle planner to pre-fill the defender's moves.
  aiProfile?: AiProfile;
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
  // null clears the AI profile.
  aiProfile?: AiProfile | null;
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

function validateRates(value: unknown): {
  rates?: EncounterRates;
  valid: boolean;
} {
  if (value === undefined || value === null) return { valid: true };
  if (!isRecord(value)) return { valid: false };
  const rates: EncounterRates = {};
  for (const [species, rate] of Object.entries(value)) {
    if (
      !cleanText(species, 100) ||
      typeof rate !== 'number' ||
      !Number.isFinite(rate) ||
      rate <= 0 ||
      rate > 100
    )
      return { valid: false };
    rates[species] = rate;
  }
  return {
    rates: Object.keys(rates).length > 0 ? rates : undefined,
    valid: true,
  };
}

function validateMethods(value: unknown): {
  methods?: RouteMethod[];
  valid: boolean;
} {
  if (value === undefined || value === null) return { valid: true };
  if (!Array.isArray(value) || value.length > MAX_ROUTE_METHODS)
    return { valid: false };
  const methods: RouteMethod[] = [];
  const names = new Set<string>();
  for (const entry of value) {
    if (!isRecord(entry)) return { valid: false };
    const name = cleanText(entry.name, MAX_TITLE_LENGTH);
    if (!name || names.has(name.toLowerCase())) return { valid: false };
    names.add(name.toLowerCase());
    const encounters = validateSpeciesList(entry.encounters ?? []);
    const rates = validateRates(entry.rates);
    if (!encounters || !rates.valid) return { valid: false };
    methods.push({
      name,
      encounters,
      ...(rates.rates ? { rates: rates.rates } : {}),
    });
  }
  return { methods: methods.length > 0 ? methods : undefined, valid: true };
}

function validateAreas(value: unknown): {
  areas?: RouteArea[];
  valid: boolean;
} {
  if (value === undefined || value === null) return { valid: true };
  if (!Array.isArray(value) || value.length > MAX_ROUTE_AREAS)
    return { valid: false };
  const areas: RouteArea[] = [];
  const names = new Set<string>();
  for (const entry of value) {
    if (!isRecord(entry)) return { valid: false };
    const name = cleanText(entry.name, MAX_TITLE_LENGTH);
    if (!name || names.has(name.toLowerCase())) return { valid: false };
    names.add(name.toLowerCase());
    const encounters = validateSpeciesList(entry.encounters ?? []);
    const rates = validateRates(entry.rates);
    const methods = validateMethods(entry.methods);
    if (!encounters || !rates.valid || !methods.valid) return { valid: false };
    areas.push({
      name,
      encounters,
      ...(rates.rates ? { rates: rates.rates } : {}),
      ...(methods.methods ? { methods: methods.methods } : {}),
    });
  }
  return { areas: areas.length > 0 ? areas : undefined, valid: true };
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
    const rates = validateRates(entry.rates);
    const areas = validateAreas(entry.areas);
    const methods = validateMethods(entry.methods);
    if (!rates.valid || !areas.valid || !methods.valid)
      return {
        messages: [
          `${label} has invalid encounter percentages, linked areas or methods.`,
        ],
      };
    const tables = [
      ...(areas.areas ?? []).flatMap((area) => [area, ...(area.methods ?? [])]),
      ...(methods.methods ?? []),
    ];
    for (const table of tables)
      for (const species of table.encounters)
        if (!encounters.includes(species)) encounters.push(species);
    routes.push({
      id: cleanText(entry.id, 64) ?? createId(),
      name,
      encounters,
      ...(rates.rates ? { rates: rates.rates } : {}),
      ...(areas.areas ? { areas: areas.areas } : {}),
      ...(methods.methods ? { methods: methods.methods } : {}),
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
    const rates = validateRates(entry.rates);
    const areas = validateAreas(entry.areas);
    const methods = validateMethods(entry.methods);
    if (!rates.valid || !areas.valid || !methods.valid)
      return {
        messages: [`${label} has invalid percentages, areas or methods.`],
      };
    const area = optionalText(entry.area, MAX_TITLE_LENGTH);
    const method = optionalText(entry.method, MAX_TITLE_LENGTH);
    if (!area.valid || !method.valid)
      return { messages: [`${label} has an invalid area or method.`] };
    if (ids.has(id)) return { messages: [`${label} has a duplicate id.`] };
    ids.add(id);
    encounters.push({
      id,
      route,
      species: species.value,
      nickname: nickname.value,
      status,
      ...(options.length > 0 ? { options } : {}),
      ...(rates.rates ? { rates: rates.rates } : {}),
      ...(areas.areas ? { areas: areas.areas } : {}),
      ...(methods.methods ? { methods: methods.methods } : {}),
      ...(area.value && areas.areas?.some((a) => a.name === area.value)
        ? { area: area.value }
        : {}),
      ...(method.value ? { method: method.value } : {}),
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

export function validateAiProfile(value: unknown): {
  aiProfile?: AiProfile | null;
  messages: string[];
} {
  if (value === null) return { aiProfile: null, messages: [] };
  const profile = AI_PROFILES.find((candidate) => candidate === value);
  return profile
    ? { aiProfile: profile, messages: [] }
    : { messages: ['aiProfile must be a supported AI profile or null.'] };
}

export function encountersForGame(
  game: Pick<NuzlockeGame, 'routes'>,
): RunEncounter[] {
  return game.routes.map((route) => ({
    id: createId(),
    route: route.name,
    status: 'pending',
    ...(route.encounters.length > 0 ? { options: route.encounters } : {}),
    ...(route.rates ? { rates: route.rates } : {}),
    ...(route.areas ? { areas: route.areas } : {}),
    ...(route.methods ? { methods: route.methods } : {}),
  }));
}

// One group of species whose chances add up together (an area and/or method).
export interface SpawnTable {
  label?: string;
  area?: string;
  method?: string;
  species: string[];
  rates: EncounterRates;
}

// Every spawn table of an encounter, narrowed to the chosen area and method.
export function spawnTables(encounter: RunEncounter): SpawnTable[] {
  const all: SpawnTable[] = [];
  const add = (
    area: string | undefined,
    method: string | undefined,
    table: { encounters: string[]; rates?: EncounterRates },
  ) => {
    if (table.encounters.length === 0) return;
    all.push({
      label: [area, method].filter(Boolean).join(' · ') || undefined,
      area,
      method,
      species: table.encounters,
      rates: table.rates ?? {},
    });
  };
  for (const area of encounter.areas ?? []) {
    add(area.name, undefined, area);
    for (const method of area.methods ?? [])
      add(area.name, method.name, method);
  }
  for (const method of encounter.methods ?? [])
    add(undefined, method.name, method);
  if (all.length === 0)
    add(undefined, undefined, {
      encounters: encounter.options ?? [],
      rates: encounter.rates,
    });

  const narrowed = all.filter(
    (table) =>
      (!encounter.area || table.area === encounter.area) &&
      (!encounter.method || table.method === encounter.method),
  );
  return narrowed.length > 0 ? narrowed : all;
}

// Runs keep their own copy of the game's routes. This refreshes the spawn data (species,
// percentages, areas, methods) from the game while keeping what was caught, matched by route name.
export function syncEncountersWithGame(
  encounters: readonly RunEncounter[],
  game: Pick<NuzlockeGame, 'routes'>,
): RunEncounter[] {
  const byRoute = new Map(
    encounters.map((encounter) => [encounter.route.toLowerCase(), encounter]),
  );
  const used = new Set<string>();
  const synced = encountersForGame(game).map((fresh) => {
    const key = fresh.route.toLowerCase();
    const existing = byRoute.get(key);
    if (!existing) return fresh;
    used.add(existing.id);
    const merged: RunEncounter = {
      id: existing.id,
      route: fresh.route,
      status: existing.status,
      ...(existing.species ? { species: existing.species } : {}),
      ...(existing.nickname ? { nickname: existing.nickname } : {}),
      ...(fresh.options ? { options: fresh.options } : {}),
      ...(fresh.rates ? { rates: fresh.rates } : {}),
      ...(fresh.areas ? { areas: fresh.areas } : {}),
      ...(fresh.methods ? { methods: fresh.methods } : {}),
    };
    const tables = spawnTables({ ...merged, method: undefined });
    const area =
      existing.area && tables.some((table) => table.area === existing.area)
        ? existing.area
        : undefined;
    const method =
      existing.method &&
      tables.some(
        (table) =>
          table.method === existing.method && (!area || table.area === area),
      )
        ? existing.method
        : undefined;
    return {
      ...merged,
      ...(area ? { area } : {}),
      ...(method ? { method } : {}),
    };
  });
  // Routes added by hand that the game doesn't know about stay at the end.
  return [...synced, ...encounters.filter((entry) => !used.has(entry.id))];
}

export function formatRate(rate: number): string {
  return `${Number(rate.toFixed(2))}%`;
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
