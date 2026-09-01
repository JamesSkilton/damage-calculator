# Issue #58 Implementation Plan

Issue: [#58 - Improve move selector UX with type and base power chips](https://github.com/JamesSkilton/damage-calculator/issues/58)

## Goal

Wire `availableMoves` so `MovePickerRow` uses `SearchableMovePicker` (with type/base power chips) instead of falling back to the plain text input.

## Execution order (runnable later)

1. **issue-58-wire-move-source**  
   Load the full move catalog in `OneVsOneMode` (generation-aware if available) and prepare `MoveOption[]`.

2. **issue-58-pass-available-moves**  
   Pass `availableMoves` into both attacker and defender `CombatantPanel` instances.

3. **issue-58-verify-searchable-ui**  
   Confirm `MovePickerRow` renders `SearchableMovePicker` when `availableMoves` is present.

4. **issue-58-add-or-fix-tests**  
   Add/update integration tests for `OneVsOneMode` wiring and visible searchable selector behavior.

5. **issue-58-run-validation**  
   Run targeted tests + build to validate behavior and type safety.

## Dependency graph

- `issue-58-pass-available-moves` depends on `issue-58-wire-move-source`
- `issue-58-verify-searchable-ui` depends on `issue-58-pass-available-moves`
- `issue-58-add-or-fix-tests` depends on `issue-58-pass-available-moves`
- `issue-58-run-validation` depends on:
  - `issue-58-verify-searchable-ui`
  - `issue-58-add-or-fix-tests`

## Current status

All plan steps are currently `pending`.
