# Pokémon Damage Calculator — UI & Product Requirements

## 1. Overview

The goal is to evolve the existing Pokémon Damage Calculator into a modern, extensible battle calculation platform.

The calculator should retain the accuracy and flexibility of the existing calculator while providing a significantly better user experience.

The long-term goal is to make the application capable of supporting:

- Standard Pokémon damage calculations
- Custom Pokémon configurations
- Custom moves and move configurations
- Trainer creation
- Trainer Pokémon teams
- Route/encounter tracking
- Pokémon caught during Nuzlockes
- Possible encounters per route
- Game-specific rules and data
- Saved Nuzlocke runs
- Battle planning
- Trainer battles
- Future Pokémon games without requiring major architectural changes

The rebuilt calculation engine is already available and should be treated as the core calculation domain rather than being tightly coupled to the UI.

---

# 2. Core Product Principles

## 2.1 The calculation result is the primary product

The most important information on the page is the result of the calculation.

The user should immediately be able to answer:

> "What happens if this Pokémon uses this move against that Pokémon?"

The result should therefore:

- Be visually dominant
- Appear before the configuration panels
- Remain visible while editing configuration where practical
- Update immediately when inputs change
- Clearly communicate damage range
- Clearly communicate damage percentage
- Clearly communicate KO probability
- Allow the user to inspect detailed calculations

The interface should feel like a live calculation tool rather than a form that must be submitted.

---

# 3. High-Level Page Structure

The calculator should be structured into the following major areas:

1. Global Controls
2. Calculation Result
3. Attacker Pokémon
4. Defender Pokémon
5. Field
6. Side Conditions
7. Import / Export

Conceptually:

```text
┌──────────────────────────────────────────────┐
│ Global Controls                              │
├──────────────────────────────────────────────┤
│                                              │
│              CALCULATION RESULT              │
│                                              │
├──────────────────────────┬───────────────────┤
│                          │                   │
│        ATTACKER          │     DEFENDER      │
│                          │                   │
├──────────────────────────┴───────────────────┤
│                    FIELD                     │
├──────────────────────────────────────────────┤
│                SIDE CONDITIONS               │
├──────────────────────────────────────────────┤
│                IMPORT / EXPORT               │
└──────────────────────────────────────────────┘