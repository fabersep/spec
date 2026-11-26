---
id: feature.<feature_slug>.acceptance_criteria
type: acceptance_criteria
feature: <feature_slug>
status: draft # draft | in_review | verified | stale | deprecated
last_updated: YYYY-MM-DD
---

# <Feature Name> — Acceptance Criteria (BDD)

> **Purpose:** Defines the testable behavioral contract for `<Feature Name>` using atomic **GIVEN / WHEN / THEN** scenarios. Serves as the shared verification truth for developers, reviewers, and AI coding agents.

---

## 1. Scenario Coverage & Traceability Matrix

| Scenario ID | Requirement | Group | Summary | Status |
| :--- | :--- | :--- | :--- | :--- |
| `AC-01` | `FR-01` | Happy Path | [Core successful behavior] | `[Verified / Pending / Failed]` |
| `AC-02` | `FR-01` | Edge Case | [Empty / boundary behavior] | `[Verified / Pending / Failed]` |
| `AC-03` | `FR-02` | Error Handling | [Invalid input rejection] | `[Verified / Pending / Failed]` |

---

## 2. BDD Authoring Rules

1. **Behavior Over Implementation:** Describe observable user, CLI, API, or agent outcomes — never internal variable names, private functions, or class internals.
2. **Atomic Scenarios:** Each scenario verifies **one** concrete outcome. Split multi-step workflows into separate scenarios.
3. **Observable Assertions:** Replace vague assertions (*"works properly"*) with concrete results (*"exits with status 0 and outputs a valid JSON report containing..."*).

---

## 3. Detailed BDD Scenarios

### Group A: Core Behavior (Happy Path)

#### Scenario AC-01: <Concise behavior title>
- **GIVEN:** [Initial state or precondition]
- **WHEN:** [Single user action, command, or trigger]
- **THEN:** [Exact observable outcome]

### Group B: Boundary & Edge Cases

#### Scenario AC-02: <Concise edge-case title>
- **GIVEN:** [Boundary condition, e.g., empty project or missing optional config]
- **WHEN:** [Action]
- **THEN:** [Graceful, deterministic outcome]

### Group C: Validation & Error Handling

#### Scenario AC-03: <Concise error-handling title>
- **GIVEN:** [Invalid input or unavailable prerequisite]
- **WHEN:** [Action]
- **THEN:** [Clear error message AND no partial/corrupt side effects]
