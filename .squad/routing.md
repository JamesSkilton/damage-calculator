# Work Routing

How to decide who handles what.

## Routing Table

| Work Type | Route To | Examples |
|-----------|----------|----------|
| Product scope, architecture, and backend decisions | Alakazam | Rewrite phases, decision reviews, backend threshold calls |
| React UI, client state, and UX flows | Rotom | App shell, calculator screens, planner interactions, component structure |
| Legacy calculator migration and typed engine wiring | Porygon | Porting logic from `old-code`, module extraction, adapter layers, parity-focused refactors |
| Battle rules, planner models, and future persistence seams | Lucario | Nuzlocke rules, encounter planning, team state, storage boundaries |
| Code review | Slowking | Review PRs, check quality, resolve trade-offs, flag naming drift |
| Consistency review | Slowking | Route naming, conventions, best-practice gaps, docs drift |
| Testing | Ditto | Write tests, build parity suites, find edge cases, verify fixes |
| Scope & priorities | Alakazam | What to build next, trade-offs, release slices |
| Session logging | Scribe | Automatic — never needs routing |
| RAI review | Rai | Content safety, bias checks, credential detection, ethical review |
| Verification & devil's advocate | Fact Checker | Fact-checking, external claims, assumption challenge |

## Issue Routing

| Label | Action | Who |
|-------|--------|-----|
| `squad` | Triage: analyze issue, assign `squad:{member}` label | Alakazam |
| `squad:alakazam` | Pick up issue and complete the work | Alakazam |
| `squad:rotom` | Pick up issue and complete the work | Rotom |
| `squad:porygon` | Pick up issue and complete the work | Porygon |
| `squad:lucario` | Pick up issue and complete the work | Lucario |
| `squad:ditto` | Pick up issue and complete the work | Ditto |
| `squad:slowking` | Review standards, naming, and consistency; leave advisory notes | Slowking |

### How Issue Assignment Works

1. When a GitHub issue gets the `squad` label, **Alakazam** triages it — analyzing content, assigning the right `squad:{member}` label, and commenting with triage notes.
2. When a `squad:{member}` label is applied, that member picks up the issue in their next session.
3. Members can reassign by removing their label and adding another member's label.
4. The `squad` label is the "inbox" — untriaged issues waiting for Lead review.
5. Code review and consistency review go to Slowking for advisory feedback.
6. Architecture, scope, and backend decisions stay with Alakazam.

## Rules

1. **React + TypeScript first.** Default to a frontend-only rewrite until the planner proves persistence, sharing, or long-running computation needs a backend.
2. **Preserve calculator correctness.** Porygon and Ditto treat the legacy calculator behavior as the baseline until the team explicitly changes it.
3. **Planner rules are explicit.** Lucario captures Nuzlocke assumptions before state or storage work spreads across the app.
4. **Quick facts → coordinator answers directly.** Don't spawn an agent for "what port does the server run on?"
5. **"Team, ..." → fan-out.** Spawn all relevant agents in parallel as `mode: "background"`.
6. **Anticipate downstream work.** If a feature is being built, Ditto starts parity and edge-case coverage from the spec at the same time.
7. **Scribe always runs** after substantial work, always as `mode: "background"`. Never blocks.
