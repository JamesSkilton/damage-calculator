# Phase 0: Parity Scope and Signoff Gate

**Related issue:** https://github.com/JamesSkilton/damage-calculator/issues/1  
**Status:** Active baseline for Phase 1/2/3 PRs

## 1) Non-negotiable parity target

The React + TypeScript rewrite must preserve the legacy calculator's core behavior for first release.  
No intentional formula or mechanics changes are allowed during parity phases unless explicitly approved as a separate decision.

## 2) Minimum parity scope (first release)

### A. Core calculator flow
- Configure attacker and defender.
- Configure selected move.
- Configure core battle field/side conditions used by mainstream calculations.
- Produce stable damage range and summary output.

### B. Key controls
- Generation selection for supported calculator paths.
- Core field controls (weather/terrain/screens/hazards and similar high-impact toggles).
- Core state modifiers needed for common calculations.

### C. Result output
- Render normalized damage range and summary/KO-oriented text.
- Keep output consistent enough for comparison against legacy scenarios.

### D. Essential utilities
- Import/export set workflow parity.
- Copy/share result parity.
- Theme preference persistence parity.

## 3) Deferred scope (explicitly not required for first parity release)

- Non-core or lower-usage mode-specific experiences beyond the primary calculator workflow.
- Nuzlocke planner features (belongs to Phase 4).
- Backend/server adoption, accounts, sync, collaboration, or remote persistence.
- Large UX redesigns that alter behavior before parity is locked.

## 4) Acceptance criteria for parity signoff

A PR or release candidate is parity-ready only when all are true:

1. Core calculator workflow works end-to-end in the new app.
2. Parity scenarios pass for representative cases across generation bands.
3. Key controls produce expected output deltas versus baseline fixtures.
4. Essential utilities (import/export/share/theme) match legacy user outcomes.
5. No unresolved high-severity parity regressions remain in tracked issues.

## 5) How this gates delivery

- **Phase 1 PRs** must not break this baseline and should move toward it.
- **Phase 2 PRs** must improve domain parity confidence (adapters + parity harness).
- **Phase 3 PRs** are considered complete only when this signoff gate is met.

## 6) Review cadence

- Re-check this document at the start of each phase and before each milestone PR.
- Any scope changes require a decision entry update before implementation.
