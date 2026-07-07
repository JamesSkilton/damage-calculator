# Squad Decisions

## Active Decisions

### 2026-07-01T22:23:46.877+01:00: Legacy feature inventory + Vite rewrite direction
**By:** Alakazam
**What:** The legacy system currently provides: multi-mode battle calculator UX (1v1 and batch-style modes), deep battle-state controls (weather/terrain/screens/hazards/format toggles), import/export/share utilities, generation-aware damage calculation engines, typed core battle models, reusable calc package surfaces, and established operational tooling (build/test/lint/CI/smoketest/static server). The refactor direction is a Vite-powered React + TypeScript rewrite in phases: **Phase 1 (Foundation)** create a Vite React TS app shell and route-level mode architecture while preserving existing calc behavior; **Phase 2 (Domain Port)** move legacy calculator wiring into typed domain adapters and shared state models; **Phase 3 (UX Consolidation)** replace page duplication with reusable React flows and feature parity for import/export/share/theme; **Phase 4 (Nuzlocke Planner)** add planner models/UI on top of shared battle domain; **Phase 5 (Backend Gate)** keep frontend-only by default and introduce backend only if planner requirements need cross-device sync, durable shared plans, collaborative/team access, or heavy async simulation workloads.
**Why:** This keeps the migration behavior-safe and incremental, preserves the trusted damage logic while modernizing delivery and developer ergonomics with Vite, and avoids premature backend complexity until phase-2 planner requirements prove a server is necessary.

### 2026-07-01T22:26:34.737+01:00: Detailed implementation plan from legacy docs
**By:** Alakazam
**What:** Use the existing legacy feature inventory and rewrite-direction notes as mandatory inputs for a detailed execution plan.

**Detailed plan (Vite + React + TypeScript):**

1. **Phase 0 — Baseline + Scope Lock**
   - Freeze parity target for current calculator behavior (no intentional formula/logic changes).
   - Define minimum parity scope for first release: primary calculator mode, key field controls, result display, import/export parity, theme parity.
   - Record deferred scope explicitly (non-core modes can be staged).

2. **Phase 1 — Vite Foundation**
   - Scaffold React + TypeScript app with Vite.
   - Establish app shell, route structure for calculator modes, shared layout, and design tokens.
   - Create typed config and environment strategy for frontend-only mode.
   - Add baseline quality gates (lint/test/build) aligned to the new toolchain.

3. **Phase 2 — Domain Port (Behavior First)**
   - Port legacy calculator integration into typed domain modules (engine adapter, battle-state mapper, result formatter).
   - Define canonical TypeScript models for attacker/defender/field/move/result to remove ad hoc UI coupling.
   - Implement parity harness against legacy outputs for representative scenarios per generation bands.
   - Keep engine-domain modules UI-agnostic so planner and potential backend can reuse them.

4. **Phase 3 — UI Feature Parity**
   - Rebuild calculator workflows with composable React components (state panels, move panels, result cards).
   - Restore high-value legacy UX features: import/export, share/copy output, theme persistence.
   - Consolidate duplicated legacy page flows into one routed app with mode-specific composition.
   - Ship parity release once acceptance criteria pass (same core calc behavior, equivalent core controls, stable UX).

5. **Phase 4 — Nuzlocke Planner (Frontend-First)**
   - Add planner domain: encounters, route progression, team snapshots, planned fights, and assumptions.
   - Build planner UI on shared battle domain modules (no forked calc logic).
   - Use local persistence first (browser storage) with typed serialization and migration-safe schema versioning.
   - Define planner-specific test matrix (edge cases: wipe branches, encounter locks, alternate plans).

6. **Phase 5 — Backend Decision Gate**
   - Stay frontend-only unless one or more are required:
     - Cross-device sync and account-bound persistence
     - Collaboration/shared plans
     - Server-side heavy simulation jobs
     - Centralized audit/history requirements
   - If gate is crossed, introduce a thin backend around existing shared domain contracts (not a domain rewrite).
   - Backend must be additive: planner storage/sync first, calc engine contracts unchanged.

**Delivery checkpoints:**
- **Checkpoint A (after Phase 2):** Engine parity confidence and typed domain stability.
- **Checkpoint B (after Phase 3):** User-facing calculator parity release.
- **Checkpoint C (after Phase 4):** Planner MVP usability and backend-gate decision.

**Why:** This plan directly operationalizes the documented legacy capabilities and constraints, keeps migration risk low through parity-first sequencing, and preserves flexibility by delaying backend adoption until planner requirements justify it.

### 2026-07-01T22:28:20.377+01:00: Phase 1 breakdown using the 4-step standard workflow
**By:** Alakazam
**What:** Phase 1 (Vite Foundation) will follow the same four-step workflow we should use for every problem.

**Phase 1 — 4 steps:**

1. **Research (files + constraints)**
   - Identify all files and inputs needed before changes:
     - Legacy references: `old-code\\damage-calc\\package.json`, `old-code\\damage-calc\\README.md`, `old-code\\damage-calc\\src\\*`, `old-code\\damage-calc\\calc\\*`
     - New app targets (to create/update): `package.json`, `vite.config.ts`, `tsconfig*.json`, `index.html`, `src\\main.tsx`, `src\\App.tsx`, `src\\routes\\*`, `src\\styles\\*`
     - Team direction: `.squad\\decisions.md`, `.squad\\routing.md`
   - Confirm phase constraints: parity-first, frontend-only default, no backend in Phase 1.

2. **Plan (work definition)**
   - Define concrete Phase 1 deliverables:
     - Vite + React + TypeScript scaffold
     - Routed app shell for calculator modes
     - Shared layout/theme baseline
     - Typed app/config foundations
     - Baseline quality gates (lint/test/build) for the new app
   - Define acceptance criteria:
     - App boots with Vite
     - Routes load and render base pages
     - Type-check/build pass
     - Foundation ready for Phase 2 domain port

3. **Implement (execute plan)**
   - Scaffold and wire Vite React TS project structure.
   - Implement route-level app shell and core shared layout primitives.
   - Add typed configuration and environment handling for frontend-only runtime.
   - Add and wire quality scripts (lint/test/build) to the new toolchain.
   - Keep implementation strictly in-scope for foundation work (no planner/backend work yet).

4. **Review (against plan)**
   - Compare delivered artifacts to Phase 1 acceptance criteria and ensure no missing deliverables.
   - Validate parity-risk posture is preserved (no accidental engine logic divergence).
   - Record outcomes and any scope drift in decisions before moving to Phase 2.

**Why:** This creates a repeatable execution model that keeps work structured, lowers migration risk, and ensures each phase is planned and verified against explicit outcomes before progressing.

### 2026-07-01T22:43:55.060+01:00: Phase 0 parity scope artifact created
**By:** Alakazam
**What:** Created `docs/phase-0-parity-scope.md` as the committed planning artifact for issue #1. It defines the non-negotiable parity target, minimum first-release parity scope, explicit deferred scope, acceptance criteria for parity signoff, and how this document gates Phase 1/2/3 pull requests.
**Why:** This converts the roadmap into an actionable quality gate so migration work can be tracked and accepted consistently through PRs instead of subjective parity judgments.

### 2026-07-01T22:59:19.866+01:00: Phase 1 scaffold established with Vite + React + TypeScript
**By:** Alakazam
**What:** Established the initial frontend foundation at the repository root with Vite, React, and TypeScript (`package.json`, TypeScript project configs, Vite config, `index.html`, and `src/*` bootstrap app files). Added startup documentation in `docs/phase-1-foundation-startup.md` and baseline scripts for `dev`, `build`, `preview`, and `typecheck`.
**Why:** This completes the first scaffold milestone for issue #2 and gives the project a working, typed frontend foundation that Phase 1 follow-up issues can build on.

## Governance

- All meaningful changes require team consensus
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction
