---
name: faber-new-feature
description: Specify a new feature from an idea by clarifying missing product dimensions first, then generating docs/features/<NN>-<slug>/prd.md and acceptance_criteria.md (BDD) aligned with the project's Master PRD and architecture. Use before building any new capability, or when the user runs faber-new-feature.
---

# faber-new-feature — Greenfield Feature Specification

Turn a feature idea into an owner-ready `prd.md` and `acceptance_criteria.md` (BDD) before writing implementation code.

## Step 1: Load Rules and Templates

Read these files relative to this `SKILL.md` first:
1. `../../rules/documentation-rules.md`
2. `../../templates/feature-prd.md`
3. `../../templates/feature-bdd.md`

## Step 2: Check Existing Project Context

Read if present in the active repository:
- `docs/master-prd.md` (align terminology, personas, and non-goals)
- `docs/architecture.md` (respect real system boundaries and constraints)
- `docs/features/README.md` (determine the next sequential feature number `<NN>` and avoid slug collisions)

## Step 3: Clarify Missing Dimensions (Before Writing)

Evaluate the user's request across 5 dimensions:
1. **Caller / Persona:** Who triggers this feature and what permissions or context do they have?
2. **Happy Path vs. Edge Cases:** What happens on empty input, invalid arguments, conflicts, or failures?
3. **State / Persistence:** Is anything stored on disk, cached, or stateless?
4. **External Interfaces / Compatibility:** Does this change a CLI flag, API, MCP schema, or file format?
5. **Boundaries / Non-Goals:** What is explicitly out of scope for the first version?

- If key dimensions are unclear, ask **3 to 5 concise, numbered questions** (with a recommended default for each) and wait for the user's answers before generating the spec.
- If the user already provided enough detail to specify cleanly, state your assumptions briefly and proceed directly.

## Step 4: Generate `prd.md` and `acceptance_criteria.md`

1. Create `docs/features/<NN>-<slug>/prd.md` following `templates/feature-prd.md` (`status: draft`, `last_updated: YYYY-MM-DD`).
2. Create `docs/features/<NN>-<slug>/acceptance_criteria.md` following `templates/feature-bdd.md` (`status: draft`, `last_updated: YYYY-MM-DD`):
   - Cover happy path, boundary/edge cases, and error handling with atomic `GIVEN / WHEN / THEN` scenarios (`AC-01`, ...).
   - Map every `FR-XX` to one or more `AC-XX` rows in the Scenario Coverage Matrix.
   - Use plain product/behavioral language — never internal variable or function names.
3. Update `docs/features/README.md` (create it if it does not exist) with the new feature row.

## Definition of Done

- [ ] `docs/features/<NN>-<slug>/prd.md` and `acceptance_criteria.md` are created with `status: draft`.
- [ ] `docs/features/README.md` is updated with the new feature.
- [ ] Every `FR-XX` maps to at least one atomic `AC-XX` scenario.
- [ ] Zero code identifiers in BDD scenarios and zero unresolved placeholders.
- [ ] Present a short key-point summary of the spec so the owner can approve it before implementation starts.
