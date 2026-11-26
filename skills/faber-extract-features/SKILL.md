---
name: faber-extract-features
description: Scan an existing (brownfield) repository to identify its discrete capabilities and generate docs/features/<NN>-<slug>/prd.md and acceptance_criteria.md for each feature, plus docs/features/README.md. Use when bringing an existing codebase into FaberSEP's spec-driven standard, or when the user runs faber-extract-features.
---

# faber-extract-features — Brownfield Feature Extraction

Discover discrete, user-facing or core domain features in an existing codebase and generate a clean `prd.md` and `acceptance_criteria.md` (BDD) for each, plus a feature index at `docs/features/README.md`.

## Step 1: Load Rules and Templates

Read these files relative to this `SKILL.md` first:
1. `../../rules/documentation-rules.md`
2. `../../templates/feature-prd.md`
3. `../../templates/feature-bdd.md`

## Step 2: Discover Features from Codebase Reality

1. **Read existing project docs** if present: `docs/master-prd.md`, `docs/architecture.md`, `README.md`, and any existing `docs/features/` folders (never duplicate already-documented features).
2. **Map the codebase:**
   - If **Atlas MCP** is available, use `map` (`zoom: 0` / `zoom: 1`) and `hubs` to identify cohesive feature slices (CLI commands, MCP tools, API domains, UI flows, core engines).
   - Otherwise inspect the source tree, entry points, and existing test suites.
3. **Group into 3–10 cohesive feature slices:**
   - Each feature must represent a meaningful capability (e.g., `01-ast-scanning`, `02-dependency-graph-queries`, `03-mcp-server`, `04-code-health`), not trivial helper utilities.
   - Ignore pure internal plumbing unless it is a standalone user-facing capability.
4. **Confirm scope when helpful:** If the feature list is large (> 6 features) or ambiguous, show the proposed numbered feature list first or proceed directly when the user asked for full extraction.

## Step 3: Generate Feature Specs

For each feature `<NN>-<slug>` (e.g., `01-core-scan`):
1. Create `docs/features/<NN>-<slug>/prd.md` following `templates/feature-prd.md`:
   - Ground every `FR-XX` strictly in verified implemented behavior (mark planned/missing items explicitly as `Planned`, never as `Implemented`).
   - Do not put internal code identifiers in functional requirements.
2. Create `docs/features/<NN>-<slug>/acceptance_criteria.md` following `templates/feature-bdd.md`:
   - Write atomic `GIVEN / WHEN / THEN` scenarios (`AC-01`, `AC-02`, ...) covering happy path, edge cases, and error handling verified against the codebase and tests.
   - Map every `AC-XX` back to its `FR-XX` in the Scenario Coverage Matrix.
   - Zero internal variable/function/class names in scenarios.
3. Create or update `docs/features/README.md` with a summary table linking every feature folder, its status, and a one-line description.

## Definition of Done

- [ ] `docs/features/README.md` lists all extracted features with links and statuses.
- [ ] Every feature folder contains both `prd.md` and `acceptance_criteria.md` following the templates.
- [ ] Every `FR-XX` is covered by at least one `AC-XX` scenario.
- [ ] Zero invented features, zero code identifiers in BDD scenarios, zero unresolved placeholders.
- [ ] Report a concise summary of extracted features and any detected gaps to the user.
