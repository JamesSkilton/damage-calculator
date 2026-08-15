# Nuzlocke One-Stop-Shop — Design & Architecture Proposal

## 1. Overview

The goal is to evolve the Pokémon damage calculator into a broader **Nuzlocke planning and management platform**.

The core idea is:

> **A single application for managing a Nuzlocke from start to finish — game data, Pokémon, encounters, routes, trainers, battles, calculations, and run history.**

The damage calculator remains an important part of the system, but it should become one capability within a larger domain model.

The long-term vision is to support:

* Multiple Pokémon games
* Different generations and mechanics
* ROM hacks / modified games
* Custom game definitions
* Nuzlocke rulesets
* Pokémon caught during a run
* Route and encounter tracking
* Trainer databases
* Trainer team configuration
* Battle planning
* Damage calculations
* Run history
* Potentially battle risk analysis and planning

The system should be designed from the beginning so that **adding another game is primarily a data problem, not a code rewrite**.

---

# 2. Core Architectural Principles

## 2.1 Separate game data from run data

This is the most important architectural decision.

There are two fundamentally different types of information:

### Game data

Static information about a game:

* Pokémon species
* Forms
* Moves
* Abilities
* Items
* Locations
* Encounter tables
* Trainers
* Trainer teams
* Game mechanics
* Evolution data
* Learnsets
* Base stats

### Run data

Information belonging to one player's Nuzlocke:

* Pokémon caught
* Nicknames
* Individual stats
* Party
* Boxes
* Deaths
* Encounters
* Locations visited
* Battle history
* Progress
* Rule violations
* Run events

The relationship should look like:

```text
Game Definition
      │
      ├── Species
      ├── Moves
      ├── Abilities
      ├── Items
      ├── Locations
      ├── Encounters
      └── Trainers
             │
             ▼
           Run
             │
             ├── Pokémon
             ├── Encounters
             ├── Deaths
             ├── Party / Boxes
             └── Events
```

A global game definition should never be mutated because a user caught or lost a Pokémon.

---

# 3. Game Definitions

A game should be represented as a self-contained definition.

Conceptually:

```ts
interface GameDefinition {
  id: string;
  name: string;

  generation: number;

  species: SpeciesData;
  moves: MoveData;
  abilities: AbilityData;
  items: ItemData;

  locations: LocationData;
  encounters: EncounterData;
  trainers: TrainerData;

  mechanics: MechanicsDefinition;
}
```

The application should be able to load:

```ts
const game = gameRegistry.get("pokemon-emerald");
```

and then use the same application code for:

```text
Pokémon Emerald
Pokémon FireRed
Pokémon Platinum
Pokémon HeartGold
Pokémon Black
Pokémon Black 2
Pokémon X
Pokémon Ultra Sun
Pokémon Scarlet
...
```

The goal is to avoid game-specific application logic such as:

```ts
if (game === "emerald") {
    ...
}

if (game === "fire-red") {
    ...
}
```

Game-specific behaviour should live in the game definition / mechanics layer.

---

# 4. Game vs Ruleset

A game and a ruleset should be treated as separate concepts.

For example:

```text
Game:
Pokémon FireRed

Ruleset:
Standard FireRed
```

But:

```text
Game:
Radical Red

Base Game:
FireRed

Ruleset:
Radical Red
```

A modified game may change:

* Base stats
* Abilities
* Moves
* Types
* Pokémon availability
* Encounter tables
* Trainer teams
* Trainer AI
* Mechanics
* Items
* Evolution methods

Therefore, the architecture should support:

```text
Base Game
    +
Game / Mod Overrides
    +
Ruleset
    =
Effective Game Definition
```

This should make ROM hacks and custom game variants possible without duplicating entire datasets.

---

# 5. Data Model

## 5.1 Species

Represents a Pokémon species as defined by the game.

```ts
interface Species {
  id: string;
  gameId: string;

  name: string;

  types: Type[];

  baseStats: {
    hp: number;
    attack: number;
    defense: number;
    specialAttack: number;
    specialDefense: number;
    speed: number;
  };

  abilities: AbilityId[];

  forms?: FormId[];

  evolution?: EvolutionData;

  learnset?: LearnsetData;
}
```

This represents a species, not an individual Pokémon caught during a run.

---

# 6. Individual Pokémon

An actual Pokémon belonging to a user's run should be a separate entity.

```ts
interface RunPokemon {
  id: string;
  runId: string;

  speciesId: string;

  nickname?: string;

  level: number;
  experience?: number;

  nature?: Nature;
  ability?: AbilityId;
  gender?: Gender;

  ivs: Stats;
  evs: Stats;

  moves: MoveInstance[];

  heldItem?: ItemId;

  currentHp?: number;
  status?: Status;

  locationCaught: LocationId;
  encounterId?: string;

  state:
    | "ACTIVE"
    | "BOXED"
    | "DEAD"
    | "RELEASED";
}
```

This allows the same species to appear multiple times in a run:

```text
Zigzagoon
  ├── Ziggy — alive
  ├── Ziggy2 — dead
  └── Ziggy3 — boxed
```

The global species record remains unchanged.

---

# 7. Moves

Moves should similarly be game data rather than hardcoded into the UI.

```ts
interface Move {
  id: string;
  gameId: string;

  name: string;

  type: Type;
  category: MoveCategory;

  power?: number;
  accuracy?: number;
  pp?: number;

  priority?: number;

  effects?: MoveEffect[];
}
```

The calculation engine should consume a normalized representation of a move.

---

# 8. Locations

Locations should be first-class entities.

```ts
interface Location {
  id: string;
  gameId: string;

  name: string;

  region?: string;

  parentLocation?: LocationId;

  connectedLocations?: LocationId[];

  encounterTables: EncounterTableId[];
}
```

Examples:

```text
Route 101
Route 102
Petalburg Woods
Rustboro City
Rustboro Gym
```

Locations should not merely be strings attached to Pokémon.

They are part of the game's navigable structure.

---

# 9. Encounter Tables

Encounter information should be modeled independently from the user's run.

```ts
interface EncounterTable {
  id: string;

  locationId: string;

  method:
    | "GRASS"
    | "SURF"
    | "FISHING"
    | "ROD"
    | "CAVE"
    | "STATIC"
    | "GIFT"
    | "OTHER";

  conditions?: EncounterCondition[];

  encounters: EncounterEntry[];
}
```

An encounter entry might be:

```ts
interface EncounterEntry {
  speciesId: string;

  minLevel: number;
  maxLevel: number;

  probability?: number;

  conditions?: EncounterCondition[];
}
```

This allows a location to have multiple encounter tables:

```text
Route 101

Grass
 ├── Poochyena — 45%
 ├── Zigzagoon — 45%
 └── Wurmple — 10%

Fishing
 └── Magikarp
```

---

# 10. Run Encounters

The global encounter table must remain untouched.

Instead, a run records what happened.

```ts
interface RunEncounter {
  id: string;

  runId: string;
  locationId: string;

  method: EncounterMethod;

  pokemonId?: string;

  speciesId?: string;

  status:
    | "AVAILABLE"
    | "ENCOUNTERED"
    | "CAUGHT"
    | "FAILED"
    | "SKIPPED"
    | "INVALID";

  timestamp: Date;
}
```

This allows the application to derive:

```text
Route 101

Possible:
  Poochyena
  Zigzagoon
  Wurmple

Caught:
  Zigzagoon

Remaining possibilities:
  Poochyena
  Wurmple
```

The same global game data can therefore be reused by unlimited runs.

---

# 11. Trainers

Trainers should be first-class game entities.

```ts
interface Trainer {
  id: string;
  gameId: string;

  name: string;
  class?: string;

  locationId?: string;

  team: TrainerPokemon[];
}
```

Trainer Pokémon should contain enough information to represent the actual battle.

```ts
interface TrainerPokemon {
  speciesId: string;

  level: number;

  ability?: AbilityId;
  item?: ItemId;
  nature?: Nature;

  moves: MoveId[];

  ivs?: Stats;
  evs?: Stats;

  gender?: Gender;

  overrides?: Record<string, unknown>;
}
```

This should support:

```text
Gym Leader Roxanne

Geodude
Lv 12
Ability: Sturdy
Moves:
  Tackle
  Defense Curl
  Rock Tomb

Nosepass
Lv 14
Ability: Sturdy
Moves:
  Block
  Harden
  Rock Tomb
  Rock Throw
```

The important part is that the trainer's team can be passed directly into the battle calculator.

---

# 12. Rebuilt Calculation Engine

The existing calculation engine has been rebuilt, so it should be treated as a **first-party domain component** rather than something the application is tightly coupled to externally.

The architecture should ideally be:

```text
Nuzlocke Domain
       │
       ▼
Battle State
       │
       ▼
Battle / Calculation Engine
       │
       ├── Damage
       ├── Accuracy
       ├── Critical Hits
       ├── Status
       ├── Field Effects
       ├── Weather
       ├── Terrain
       └── Other Mechanics
```

The key boundary should be the `BattleState`.

```ts
interface BattleState {
  gameId: string;
  rulesetId: string;

  player: BattleSide;
  opponent: BattleSide;

  field: BattleField;

  turn: number;
}
```

The Nuzlocke application should not need to know how damage is calculated.

It should be able to say:

```ts
const battle = createBattleState({
  player: runPokemon,
  opponent: trainerPokemon,
  field,
});

const result = calculator.calculate(battle);
```

This keeps the calculation engine independent from the UI and Nuzlocke-specific concepts.

---

# 13. Battle Planner

One of the most valuable features should be a battle planning layer on top of the calculator.

For example:

```text
GYM LEADER ROXANNE

Opponent
──────────────────────────

Geodude Lv 12
Nosepass Lv 14

Your Party
──────────────────────────

Mars       Lv 15
Steve      Lv 14
Susan      Lv 13
```

The user should be able to select:

```text
Mars → Geodude
Mars → Nosepass
Steve → Geodude
Steve → Nosepass
Susan → Geodude
Susan → Nosepass
```

and immediately inspect the calculations.

---

# 14. Team-vs-Team Analysis

The application should eventually support a matchup matrix.

Example:

|       | Geodude | Graveler | Nosepass |
| ----- | ------: | -------: | -------: |
| Mars  |      🟢 |       🟢 |       🟡 |
| Steve |      🟢 |       🟡 |       🔴 |
| Susan |      🟡 |       🟡 |       🟢 |

Clicking a cell should open the detailed calculation.

The matrix should eventually answer questions such as:

* Can I OHKO?
* Can they OHKO me?
* How many hits are required?
* What is the damage range?
* Can I safely switch in?
* What happens after chip damage?
* What happens on a critical hit?
* What happens after status/weather/terrain effects?

---

# 15. Nuzlocke Rules

Nuzlocke rules should be configurable rather than hardcoded.

Potential configuration:

```ts
interface NuzlockeRules {
  encounterRule: EncounterRule;

  duplicateClause: boolean;
  shinyClause: boolean;

  staticEncounterRule: EncounterRule;
  giftPokemonRule: EncounterRule;

  deathRule: DeathRule;

  nicknameRequired: boolean;

  levelCaps?: LevelCapRules;

  battleStyle?: "SET" | "SHIFT";

  itemsInBattleAllowed?: boolean;
}
```

Potential supported configurations:

```text
Classic Nuzlocke

Hardcore Nuzlocke

Duplicate Clause

Species Clause

Shiny Clause

No Items in Battle

Level Caps

Set Mode

Gift Pokémon count as encounter

Static Pokémon count as encounter
```

---

# 16. Rules as Plugins

Long-term, rules should be treated as a validation system.

For example:

```ts
interface Rule {
  validate(
    event: RunEvent,
    state: RunState
  ): RuleViolation[];
}
```

This could allow rules to validate events such as:

```text
PokemonEncountered
PokemonCaught
PokemonDied
PokemonLevelled
PokemonEvolved
TrainerBattleStarted
TrainerBattleCompleted
ItemUsed
LocationEntered
```

This makes the rules engine extensible without changing the core run model.

---

# 17. Run State

A run should represent the user's current Nuzlocke.

```ts
interface Run {
  id: string;

  userId: string;

  gameId: string;
  rulesetId: string;

  name?: string;

  status:
    | "ACTIVE"
    | "COMPLETED"
    | "FAILED"
    | "ABANDONED";

  createdAt: Date;
  updatedAt: Date;
}
```

Related entities:

```text
Run
 ├── RunPokemon
 ├── RunEncounters
 ├── RunEvents
 ├── RunRules
 ├── BattlePlans
 └── Progress
```

---

# 18. Event-Based Run History

The run should ideally maintain an event history.

Instead of simply mutating:

```ts
pokemon.status = "DEAD";
```

the application should record:

```text
PokemonDied
```

as an event.

Example:

```ts
interface RunEvent {
  id: string;

  runId: string;

  type:
    | "RUN_STARTED"
    | "LOCATION_ENTERED"
    | "ENCOUNTER_OCCURRED"
    | "POKEMON_CAUGHT"
    | "POKEMON_LEVELLED"
    | "POKEMON_EVOLVED"
    | "POKEMON_DIED"
    | "POKEMON_RELEASED"
    | "TRAINER_BATTLE_STARTED"
    | "TRAINER_BATTLE_COMPLETED";

  timestamp: Date;

  data: Record<string, unknown>;
}
```

This enables a run timeline:

```text
🌱 Started Run

📍 Route 101

🐕 Encountered Zigzagoon

🐕 Caught Ziggy

🏋 Ziggy reached Lv 10

⚔️ Defeated Trainer May

💀 Lost Poochyena
```

It also opens up future functionality:

* Undo
* Run history
* Statistics
* Replay
* Auditing
* Run summaries
* "How did I lose this Pokémon?"
* Automatic progress tracking

---

# 19. Data Storage Strategy

Use two broad categories of data.

## Canonical game data

Keep this version-controlled.

Example:

```text
/data
  /games
    /firered
    /emerald
    /platinum

  /mods
    /radical-red
    /renegade-platinum
```

This data can be reviewed through Git and changed independently from user data.

## User/run data

Store this in a database.

Examples:

```text
users
runs
run_pokemon
run_encounters
run_events
battle_plans
```

This separation makes deployments, migrations, and game-data updates much easier.

---

# 20. Suggested Database Structure

A relational database such as PostgreSQL would be appropriate.

High-level structure:

```text
games
game_versions
game_overrides
rulesets

species
species_forms
moves
abilities
items

locations
encounter_tables
encounters

trainers
trainer_teams
trainer_pokemon

users

runs
run_rules
run_pokemon
run_encounters
run_events

battle_plans
battle_plan_pokemon
```

Not every piece of game data necessarily needs to be normalized into individual database tables.

Canonical game definitions could remain structured files while the database primarily stores user/run state.

---

# 21. Game Data Versioning

Game data should be versioned independently of the application.

This is particularly important for ROM hacks and modified games.

For example:

```text
Radical Red
  v3.1
  v4.0
  v4.1
```

A run should reference the specific game-data version it was created against.

Conceptually:

```ts
interface GameDataVersion {
  id: string;

  gameId: string;

  version: string;

  source: string;

  createdAt: Date;
}
```

This prevents historical runs from silently changing when game data is updated.

---

# 22. Overrides

Modified games should ideally be represented as overrides rather than duplicated datasets.

For example:

```text
FireRed
    +
Radical Red Overrides
    =
Radical Red
```

A simple override could look conceptually like:

```json
{
  "species": {
    "pikachu": {
      "baseStats": {
        "speed": 120
      }
    }
  }
}
```

Or:

```json
{
  "encounters": {
    "route-1": {
      "grass": [
        ...
      ]
    }
  }
}
```

This allows a ROM hack to inherit most of its base game's definition while overriding only what changed.

---

# 23. Data Editor

The system should eventually include an editor for game data.

Examples:

```text
Species Editor
Move Editor
Ability Editor
Item Editor
Trainer Editor
Trainer Team Editor
Location Editor
Encounter Table Editor
```

A species editor could expose:

```text
Charizard

Types:
  Fire
  Flying

Base Stats:
  HP      [78]
  Attack  [84]
  Defense [78]
  Sp. Atk [109]
  Sp. Def [85]
  Speed   [100]

Abilities:
  Blaze
  Solar Power

[Save]
```

The UI should manipulate structured data rather than requiring users to edit JSON manually.

---

# 24. Data Provenance

Game data should track where it came from.

Potential metadata:

```ts
interface DataSource {
  source: string;

  version?: string;

  importedAt: Date;

  verifiedAt?: Date;
}
```

This becomes increasingly important when supporting:

* Multiple game versions
* ROM hacks
* Community contributions
* Different trainer sets
* Changed encounter tables
* Changed mechanics

It should always be possible to answer:

> "Where did this data come from?"

and:

> "Which version of the data is this?"

---

# 25. Application Architecture

A possible high-level architecture:

```text
┌───────────────────────────────────────────────┐
│                    Web App                    │
│                                               │
│ Dashboard / Runs / Pokémon / Routes / Battles │
└───────────────────────┬───────────────────────┘
                        │
                        ▼
┌───────────────────────────────────────────────┐
│                 Application API               │
│                                               │
│ Run Management                                │
│ Encounter Management                          │
│ Trainer Management                            │
│ Battle Planning                               │
│ Game Data                                     │
└───────────────┬───────────────────┬───────────┘
                │                   │
                ▼                   ▼
       ┌────────────────┐   ┌──────────────────┐
       │  Nuzlocke      │   │  Game Data       │
       │  Domain        │   │  Registry        │
       │                │   │                  │
       │ Rules          │   │ Games            │
       │ Runs           │   │ Species          │
       │ Encounters     │   │ Moves            │
       │ Events         │   │ Trainers         │
       └───────┬────────┘   │ Encounters       │
               │            └────────┬─────────┘
               │                     │
               └──────────┬──────────┘
                          ▼
                 ┌──────────────────┐
                 │   Battle State   │
                 └────────┬─────────┘
                          ▼
                 ┌──────────────────┐
                 │ Rebuilt Calc     │
                 │ Engine           │
                 └──────────────────┘
```

The calculation engine should remain independent from:

* React/UI concerns
* Database concerns
* Authentication
* Nuzlocke rules
* Routing
* API implementation

---

# 26. Suggested Repository Structure

A monorepo would be a good fit.

```text
nuzlocke-calc/
│
├── apps/
│   ├── web/
│   └── api/
│
├── packages/
│   │
│   ├── domain/
│   │   ├── pokemon/
│   │   ├── moves/
│   │   ├── trainers/
│   │   ├── locations/
│   │   ├── encounters/
│   │   └── runs/
│   │
│   ├── game-data/
│   │   ├── core/
│   │   ├── games/
│   │   └── mods/
│   │
│   ├── battle/
│   │   ├── state/
│   │   ├── planner/
│   │   └── engine/
│   │
│   ├── nuzlocke/
│   │   ├── rules/
│   │   └── validation/
│   │
│   └── ui/
│
└── scripts/
    ├── import/
    ├── validate/
    └── generate/
```

The exact structure can change, but the conceptual separation should remain.

---

# 27. User Experience

The application should eventually move beyond being "a calculator with Nuzlocke features."

The primary navigation could become:

```text
Dashboard
Runs
Pokémon
Routes
Trainers
Battle Planner
Calculator
Game Data
```

---

# 28. Run Dashboard

Example:

```text
Pokémon Emerald — Hardcore Nuzlocke

────────────────────────────────────────

18 Alive     6 Dead     32 Locations

Current Location
────────────────────────────────────────

Mt. Chimney

Encounter:
???

Possible:
Slugma
Numel
Machop

Upcoming:
🔴 Flannery
Level Cap: 28

[Plan Battle]
[View Map]
[Manage Pokémon]
```

---

# 29. Pokémon Management

The system should support:

```text
Party
Boxes
Dead
Released
```

Example:

```text
PARTY

🔥 Blaze       Lv 31
🌿 Treecko     Lv 29
⚡ Sparky      Lv 27
💧 Aqua        Lv 26
```

Clicking a Pokémon should open its complete run-specific state and history.

---

# 30. Route / Map Interface

The map should communicate both game information and run state.

Example:

```text
                    Route 112
                        │
                        │
Route 111 ─────── Mauville ─────── Route 118
                        │
                    Route 110
```

Locations can have states:

```text
🟢 Encounter available
⚪ Encounter completed
💀 Pokémon lost here
🔒 Not yet accessible
```

Clicking a route should show:

* Available encounters
* Encounter methods
* Level ranges
* Encounter probabilities
* What the player caught
* What remains available
* Route history

---

# 31. Trainer Interface

Trainers should be browsable by:

```text
Gym Leaders
Elite Four
Rivals
Important Trainers
Route Trainers
Bosses
```

A trainer page:

```text
GYM LEADER ROXANNE

Location:
Rustboro Gym

Team:
Geodude Lv 12
Nosepass Lv 14

[Plan Battle]
```

The important interaction is:

```text
Trainer → Plan Battle → Calculator
```

There should be no need to manually rebuild the trainer's team.

---

# 32. Battle Planner

The battle planner should be able to automatically load:

```text
Player Run
      +
Trainer
      +
Game Mechanics
      +
Current Pokémon State
```

and create:

```text
BattleState
```

This can then be consumed by the calculation engine.

---

# 33. Future: Risk Analysis

Once the calculation system is robust, the application can go beyond raw damage numbers.

For example:

```text
Vaporeon → Starmie

Psychic
Damage: 42–49

Survival: 100%
2HKO: 100%

Critical Hit:
Survival: 72%
```

The application could flag:

```text
⚠ Dangerous

This Pokémon has a chance to be KO'd
after existing chip damage.
```

This should be considered a later-stage feature, not an MVP requirement.

---

# 34. Future: Team Analysis

Eventually the user could ask:

> "Which Pokémon on my team are safest against this trainer?"

or:

> "What is my safest lead?"

or:

> "Which available encounter would improve my upcoming matchup?"

This opens the door to strategy tooling built on top of the battle engine.

---

# 35. Future: Encounter Planning

Once routes, encounters, Pokémon and trainers are all connected, the system can provide higher-level recommendations.

For example:

```text
Next Major Battle:
Flannery

Weaknesses:
Water
Ground
Rock

Current Team Coverage:
Water: Good
Ground: Poor
Rock: Good

Available Encounters:
Numel
Barboach
Marill

Best potential additions:
Barboach
Marill
```

This is a potential long-term differentiator.

---

# 36. Suggested Development Phases

## Phase 0 — Architecture / Foundations

Before building significant UI functionality:

### Goals

* Define domain boundaries
* Define game-data format
* Define run-data format
* Define BattleState
* Define calculation-engine API
* Define game registry
* Define versioning strategy

### Deliverables

```text
GameDefinition
Species
Move
Ability
Item
Location
EncounterTable
Trainer
TrainerPokemon
Run
RunPokemon
RunEncounter
RunEvent
BattleState
NuzlockeRules
```

Also establish:

* Repository structure
* TypeScript types/interfaces
* Validation strategy
* Test strategy
* Data import pipeline

---

# Phase 1 — Rebuilt Calculator Integration

Integrate the rebuilt calculation engine with the new domain model.

### Goals

* Run Pokémon can become calculator Pokémon
* Trainer Pokémon can become calculator Pokémon
* BattleState can be created from domain objects
* Calculation results can be returned to the application

### Example

```text
RunPokemon
      ↓
Battle Adapter
      ↓
BattleState
      ↓
Calculation Engine
      ↓
Calculation Result
```

### Success Criteria

A user can select:

```text
My Pokémon
vs
Trainer Pokémon
```

and immediately perform a calculation without manually configuring the Pokémon.

---

# Phase 2 — Basic Nuzlocke Run Management

Build the actual run system.

### Features

* Create run
* Select game
* Select ruleset
* Party
* PC / boxes
* Add Pokémon
* Nicknames
* Level
* Moves
* Nature
* Ability
* IVs / EVs
* Mark Pokémon dead
* Release Pokémon
* Run status

### Deliverable

A user can create and manage a complete basic Nuzlocke run.

---

# Phase 3 — Locations and Encounters

Add:

* Location database
* Encounter tables
* Encounter methods
* Route completion
* Caught Pokémon
* Failed encounters
* Encounter history
* Remaining encounters

### Key UX

Opening a route should answer:

> "What can I catch here?"

and:

> "What have I already used here?"

---

# Phase 4 — Trainers

Add:

* Trainer database
* Trainer teams
* Gym leaders
* Elite Four
* Rivals
* Important battles
* Trainer locations

### Key UX

Opening a trainer should immediately show their team.

---

# Phase 5 — Battle Planner

Connect:

```text
Run
+
Trainer
+
Calculator
```

### Features

* One-click battle setup
* Player team vs trainer team
* Matchup matrix
* Damage ranges
* KO probability
* Survival analysis
* Field conditions
* Level caps

### Goal

Make battle preparation significantly faster than manually configuring a calculator.

---

# Phase 6 — Run Timeline / Event System

Introduce event history.

### Events

```text
Run started
Location entered
Encounter occurred
Pokémon caught
Pokémon levelled
Pokémon evolved
Pokémon died
Pokémon released
Trainer battle started
Trainer battle completed
```

### Features

* Timeline
* Run history
* Statistics
* Undo
* Auditability

---

# Phase 7 — Data Tooling

Build internal tooling to make adding games significantly easier.

### Tools

* Game importer
* Species editor
* Move editor
* Ability editor
* Item editor
* Location editor
* Encounter editor
* Trainer editor
* Trainer team editor

### Goal

Adding a new game should become:

```text
Import / configure data
        ↓
Validate
        ↓
Register game
        ↓
Available in application
```

rather than:

```text
Modify application code
        ↓
Modify UI
        ↓
Modify calculator
        ↓
Modify database
        ↓
Add special cases
```

---

# Phase 8 — Game Variants / ROM Hacks

Implement:

* Base game inheritance
* Data overrides
* Mechanics overrides
* Versioned game definitions
* Custom game definitions

Example:

```text
FireRed
   ↓
Radical Red
   ├── Modified species
   ├── Modified moves
   ├── Modified abilities
   ├── Modified encounters
   ├── Modified trainers
   └── Modified mechanics
```

---

# Phase 9 — Advanced Nuzlocke Intelligence

Only after the underlying data model is stable.

Potential features:

### Risk analysis

```text
Can this Pokémon survive?

Can this attack KO?

What happens after chip?

What happens on a critical hit?
```

### Team analysis

```text
Which Pokémon is safest?

What is my best lead?

What are my worst matchups?
```

### Encounter analysis

```text
Which remaining encounters improve
my upcoming battles?
```

### Battle planning

Potentially:

```text
Find the safest sequence of moves
against the trainer's team.
```

This should be treated as an advanced layer on top of the core architecture.

---

# 37. MVP Definition

The first usable release should probably be considerably smaller than the final vision.

A strong MVP would include:

```text
✓ One game

✓ Game data abstraction

✓ Rebuilt calculation engine

✓ Create a Nuzlocke run

✓ Configure Nuzlocke rules

✓ Add / manage Pokémon

✓ Party + boxes

✓ Mark Pokémon dead

✓ Locations

✓ Encounter tables

✓ Record encounters

✓ Trainer database

✓ Trainer teams

✓ One-click Trainer → Calculator

✓ Basic run history
```

Do **not** initially build:

```text
✗ Multiple games
✗ ROM hack support
✗ Full data editor
✗ Advanced risk analysis
✗ AI battle planning
✗ Encounter optimization
✗ Community content system
```

Those become substantially easier once the foundation is correct.

---

# 38. Key Architectural Risks

## Risk 1 — Game-specific logic leaks everywhere

Bad:

```ts
if (game === "emerald") {
   ...
}
```

Prefer:

```ts
game.mechanics.calculateSomething(...)
```

or a game-specific rules/mechanics implementation.

---

## Risk 2 — Mixing global and run Pokémon

Bad:

```text
Pokemon
  status = dead
```

Good:

```text
Species
  "Pikachu"

RunPokemon
  "Sparky"
  status = DEAD
```

---

## Risk 3 — Hardcoding Nuzlocke rules

Avoid:

```ts
if (encounterAlreadyUsed) {
   throw ...
}
```

Instead:

```ts
rules.validate(event, state)
```

---

## Risk 4 — Duplicating ROM hack data

Avoid copying an entire game dataset just to modify a handful of values.

Prefer:

```text
Base Game
+
Overrides
```

---

## Risk 5 — Treating the calculator as the application

The calculator is a subsystem.

The broader architecture is:

```text
Game Data
+
Run Data
+
Rules
+
Battle State
+
Calculation Engine
```

---

# 39. North Star Architecture

The eventual architecture should look roughly like this:

```text
                         ┌───────────────────┐
                         │     Web App       │
                         │                   │
                         │ Dashboard         │
                         │ Runs              │
                         │ Pokémon           │
                         │ Routes            │
                         │ Trainers          │
                         │ Battle Planner    │
                         │ Calculator        │
                         └─────────┬─────────┘
                                   │
                                   ▼
                         ┌───────────────────┐
                         │  Application API  │
                         └─────────┬─────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                    │
              ▼                    ▼                    ▼
      ┌──────────────┐     ┌───────────────┐    ┌──────────────┐
      │ Nuzlocke     │     │ Game Data     │    │ Battle       │
      │ Domain       │     │ Registry      │    │ Domain       │
      │              │     │               │    │              │
      │ Runs         │     │ Games         │    │ BattleState  │
      │ Rules        │     │ Species       │    │ Battle Plans │
      │ Encounters   │     │ Moves         │    │ Matchups     │
      │ Events       │     │ Trainers      │    │              │
      └──────┬───────┘     │ Locations     │    └──────┬───────┘
             │             └───────┬───────┘           │
             │                     │                    │
             └─────────────────────┼────────────────────┘
                                   │
                                   ▼
                         ┌───────────────────┐
                         │  Rebuilt Calc     │
                         │      Engine       │
                         └───────────────────┘
```

---

# 40. Final Product Vision

The end product should feel less like:

> "A Pokémon damage calculator with some Nuzlocke features."

and more like:

> **"The operating system for a Pokémon Nuzlocke."**

A player should be able to:

```text
Choose Game
    ↓
Create Run
    ↓
Choose Rules
    ↓
Track Locations
    ↓
Track Encounters
    ↓
Manage Pokémon
    ↓
Browse Trainers
    ↓
Plan Battles
    ↓
Calculate Damage
    ↓
Record Results
    ↓
Continue Run
```

And eventually the system can start connecting these pieces:

```text
"What can I catch?"
        ↓
"What should I catch?"
        ↓
"What is my next major battle?"
        ↓
"Which of my Pokémon are safest?"
        ↓
"What happens if I lead with this?"
        ↓
"What's the safest battle line?"
```

That is the long-term opportunity.

The **calculation engine is the battle simulation layer**.

The **game-data system is the knowledge layer**.

The **Nuzlocke system is the state/rules layer**.

The **battle planner is the decision-support layer**.

And the UI ties all four together into a single Nuzlocke experience.
