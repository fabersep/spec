---
id: faber.documentation-rules
type: documentation_rules
status: verified
version: 0.2.0
---

# FaberSEP Documentation Standards & Governance Rules

> **Purpose:** Core invariants for spec-driven software engineering. Both human developers and AI coding agents follow these rules when creating or updating project documentation.

---

## 1. The Tripartite Separation of Concerns

Every project separates three distinct kinds of truth:

1. **Architecture (`docs/architecture.md`) — *HOW the system is built*:** Real directory layout, module boundaries, runtime dependencies, data flow, entry points, and constraints grounded in code.
2. **Product Requirements (`docs/master-prd.md`, `docs/features/<slug>/prd.md`) — *WHAT & WHY*:** Problem statement, users/personas, capabilities, functional requirements (`FR-XX`), boundaries (non-goals), and edge cases in plain product language.
3. **Acceptance Criteria (`docs/features/<slug>/acceptance_criteria.md`) — *HOW we verify it*:** Atomic, testable `GIVEN / WHEN / THEN` behavioral contracts (`AC-XX`) written in user/domain language — never code identifiers.

**Conflict Rule:** When a PRD disagrees with the codebase, the codebase reflects *current reality* and the PRD reflects *intended behavior*. Record the gap explicitly — never invent code to hide a mismatch.

---

## 2. Core Invariants (Non-Negotiable)

1. **Evidence First (Zero Hallucination):**
   - Never guess APIs, CLI flags, routes, formulas, dependencies, or configurations that you have not verified in the codebase or from the user.
   - Record missing or unverified information explicitly as `GAP-XX` or `UNKNOWN: <reason>`.
2. **Project-Type Agnostic:**
   - Adapt every template to the actual project archetype (CLI tool, library, MCP server, API service, web app, mobile app, plugin).
   - Never force irrelevant sections (e.g., mobile monetization or UI screens on a headless CLI). Mark non-applicable sections `N/A` with a one-line reason or omit clearly marked optional blocks.
3. **No Code Identifiers in PRDs & BDDs:**
   - PRDs and BDD scenarios describe observable user/developer/system behavior, not internal class names, variable names, or private function signatures.
   - Public interfaces (such as CLI commands, HTTP endpoints, or MCP tool names) may be referenced as user-facing touchpoints.
4. **Atomic, Traceable Scenarios:**
   - Every BDD scenario (`AC-XX`) verifies **one** observable outcome.
   - Every functional requirement (`FR-XX`) in a feature PRD maps to at least one scenario in the Scenario Coverage Matrix.
5. **Zero Unresolved Placeholders:**
   - Finished documents must never contain template placeholders (`<...>`, `{{...}}`, `[TODO]`, `[TBD]`).
6. **Surgical Updates & Stability:**
   - Keep frontmatter (`id`, `type`, `status`, `last_updated`) and section ordering stable.
   - Update only the sections affected by a change; mark deprecated capabilities explicitly instead of silently deleting history.

---

## 3. Canonical Documentation Layout

```text
docs/
├── master-prd.md                        # Product vision, users, workflows, non-goals, KPIs
├── architecture.md                      # System & code architecture (or docs/architecture/ for multi-tier repos)
└── features/
    ├── README.md                        # Feature index with status & links
    └── <NN>-<feature-slug>/
        ├── prd.md                       # Feature PRD (FR-XX)
        └── acceptance_criteria.md       # Feature BDD scenarios (AC-XX)
```

---

## 4. Document Status Lifecycle

- `draft` — Initial synthesis awaiting human review.
- `in_review` — Under review before implementation or release.
- `verified` — Approved by the project owner and aligned with codebase reality.
- `stale` — Code has diverged; refresh required.
- `deprecated` — Replaced or retired (link to replacement).

---

## 5. Plugin Skill Naming Convention

- Every skill in `fabersep/spec` **must** use the `faber-` prefix (e.g. `faber-init-arch`, `faber-new-feature`, `faber-discuss`) to prevent naming collisions across global agent plugins.
