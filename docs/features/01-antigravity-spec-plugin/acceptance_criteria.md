---
id: feature.antigravity-spec-plugin.acceptance_criteria
type: acceptance_criteria
feature: antigravity-spec-plugin
status: draft
last_updated: 2026-11-26
---

# Antigravity Spec Plugin — Acceptance Criteria (BDD)

> **Purpose:** Atomic **GIVEN / WHEN / THEN** verification contract for `01-antigravity-spec-plugin`.

---

## 1. Scenario Coverage & Traceability Matrix

| Scenario ID | Requirement | Group | Summary | Status |
| :--- | :--- | :--- | :--- | :--- |
| `AC-01` | `FR-01` | Plugin Discovery | Antigravity discovers `faber-spec` with all four `faber-*` skills | `Pending` |
| `AC-02` | `FR-02` | Clean Repo | Running a skill writes only generated `docs/` with no template clutter | `Pending` |
| `AC-03` | `FR-02` | Lean Context | Plugin adds no always-on rules file when idle | `Verified` |
| `AC-04` | `FR-03` | Brownfield Init | `faber-init-arch` and `faber-init-prd` produce grounded docs without Atlas MCP | `Pending` |
| `AC-05` | `FR-04` | Feature Extraction | `faber-extract-features` generates feature index, PRDs, and traceable BDDs | `Pending` |
| `AC-06` | `FR-04` | New Feature Flow | `faber-new-feature` asks clarifying questions when scope is incomplete before writing specs | `Pending` |

---

## 2. BDD Authoring Rules

1. Describe observable developer and agent outcomes — never internal code identifiers.
2. Keep each scenario atomic (one verifiable outcome).
3. State exact observable outputs and file locations.

---

## 3. Detailed BDD Scenarios

### Group A: Plugin Discovery & Cleanliness

#### Scenario AC-01: Antigravity loads the plugin and all four skills
- **GIVEN:** The `fabersep/spec` repository is installed in Antigravity's global plugins directory
- **WHEN:** Antigravity inventories installed plugins
- **THEN:** The plugin **FaberSEP Spec** appears as enabled AND exposes the four skills `faber-init-arch`, `faber-init-prd`, `faber-extract-features`, and `faber-new-feature`.

#### Scenario AC-02: Target repository remains free of template clutter
- **GIVEN:** A developer runs any `faber-*` skill inside a target project repository
- **WHEN:** The skill finishes generating documentation
- **THEN:** Only the target project's generated files under `docs/` are created or updated AND no template files, rule files, or plugin manifests are copied into the target repository.

#### Scenario AC-03: Zero always-on rule injection
- **GIVEN:** The `faber-spec` plugin is installed and enabled
- **WHEN:** A developer starts an unrelated coding conversation without invoking a `faber-*` skill
- **THEN:** No global plugin rules file is automatically injected into the conversation context.

### Group B: Brownfield & Greenfield Workflows

#### Scenario AC-04: Brownfield architecture and Master PRD generation without Atlas MCP
- **GIVEN:** An existing repository with source code and no `docs/` folder, and no Atlas MCP server connected
- **WHEN:** The developer runs `faber-init-arch` and `faber-init-prd`
- **THEN:** The agent falls back cleanly to inspecting repository files AND generates `docs/architecture.md` and `docs/master-prd.md` with valid frontmatter, zero unresolved placeholders, and any unknowns recorded as `GAP-XX`.

#### Scenario AC-05: Brownfield feature extraction with traceability
- **GIVEN:** An existing repository with multiple distinct capabilities
- **WHEN:** The developer runs `faber-extract-features`
- **THEN:** `docs/features/README.md` is created listing each extracted feature AND every feature folder contains both `prd.md` and `acceptance_criteria.md` where every `FR-XX` maps to at least one `AC-XX` scenario written without internal code identifiers.

#### Scenario AC-06: Greenfield feature clarification before spec generation
- **GIVEN:** A developer invokes `faber-new-feature` with an underspecified one-line feature idea
- **WHEN:** The agent evaluates the request
- **THEN:** The agent asks 3 to 5 concise clarifying questions before writing `prd.md` and `acceptance_criteria.md`.
