# Squad Team

> React + TypeScript refresh of a Pokemon damage calculator, with a Nuzlocke fight planner queued for phase 2.

## Coordinator

| Name | Role | Notes |
|------|------|-------|
| Squad | Coordinator | Routes work, enforces handoffs and reviewer gates. |

## Members

| Name | Role | Charter | Status |
|------|------|---------|--------|
| Alakazam | Lead | `.squad/agents/alakazam/charter.md` | ✅ Active |
| Rotom | Frontend Dev | `.squad/agents/rotom/charter.md` | ✅ Active |
| Porygon | Migration Engineer | `.squad/agents/porygon/charter.md` | ✅ Active |
| Lucario | Battle Systems / Data Model | `.squad/agents/lucario/charter.md` | ✅ Active |
| Ditto | Tester | `.squad/agents/ditto/charter.md` | ✅ Active |
| Slowking | Standards Reviewer | `.squad/agents/slowking/charter.md` | ✅ Active |
| Scribe | Session Logger | `.squad/agents/scribe/charter.md` | 📋 Silent |
| Ralph | Work Monitor | `.squad/agents/ralph/charter.md` | 🔄 Monitor |
| Rai | RAI Reviewer | `.squad/agents/Rai/charter.md` | 🛡️ RAI |
| Fact Checker | Fact Checker | `.squad/agents/fact-checker/charter.md` | 🔍 Verifier |

## Coding Agent

<!-- copilot-auto-assign: false -->

| Name | Role | Charter | Status |
|------|------|---------|--------|
| @copilot | Coding Agent | — | 🤖 Coding Agent |

### Capabilities

**🟢 Good fit — auto-route when enabled:**
- Bug fixes with clear reproduction steps
- Test coverage (adding missing tests, fixing flaky tests)
- Lint/format fixes and code style cleanup
- Dependency updates and version bumps
- Small isolated features with clear specs
- Boilerplate/scaffolding generation
- Documentation fixes and README updates

**🟡 Needs review — route to @copilot but flag for squad member PR review:**
- Medium features with clear specs and acceptance criteria
- Refactoring with existing test coverage
- API endpoint additions following established patterns
- Migration scripts with well-defined schemas

**🔴 Not suitable — route to squad member instead:**
- Architecture decisions and system design
- Multi-system integration requiring coordination
- Ambiguous requirements needing clarification
- Security-critical changes (auth, encryption, access control)
- Performance-critical paths requiring benchmarking
- Changes requiring cross-team discussion

## Project Context

- **Owner:** JamesSkilton
- **Project:** pokemans
- **Stack:** Legacy `old-code\\damage-calc` fork built around Node and a TypeScript damage engine with a JS UI; target refresh is React + TypeScript with backend still undecided
- **Description:** Rebuild the Pokemon damage calculator as a modern React + TypeScript app, then evaluate whether the Nuzlocke fight-planning feature needs a backend in phase 2
- **Created:** 2026-07-01T22:10:40.189+01:00
