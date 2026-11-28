---
id: feature.cli-installer-and-cross-model-discuss.acceptance_criteria
type: acceptance_criteria
feature: cli-installer-and-cross-model-discuss
status: draft
last_updated: 2026-11-28
---

# Multi-Agent CLI Installer & Cross-Model Discuss — Acceptance Criteria (BDD)

> **Purpose:** Atomic **GIVEN / WHEN / THEN** verification contract for `02-cli-installer-and-cross-model-discuss`.

---

## 1. Scenario Coverage & Traceability Matrix

| Scenario ID | Requirement | Group | Summary | Status |
| :--- | :--- | :--- | :--- | :--- |
| `AC-01` | `FR-01` | Auto-Detection | Installer detects present AI coding tool directories and marks missing ones as not detected | `Verified` |
| `AC-02` | `FR-01` | Dry Run | Running `init --dry-run` reports planned changes without creating files on disk | `Verified` |
| `AC-03` | `FR-02` | Multi-Agent Wiring | Running `init` stages `~/.faber/spec/` and wires plugin and per-skill targets cleanly | `Verified` |
| `AC-04` | `FR-02` | Backup Safety | An unmanaged existing directory at a target path is backed up before linking | `Verified` |
| `AC-05` | `FR-02` | Cross-Agent Skill Paths | Every `faber-*` skill provides both relative and `~/.faber/spec/` fallback paths | `Verified` |
| `AC-06` | `FR-03` | Status & Uninstall | `status` reports installed tools and `uninstall` removes managed links and canonical store cleanly | `Verified` |
| `AC-07` | `FR-04` | Read-Only Reviewer | `faber-discuss` builds strictly read-only commands for both `agy` and `claude` CLIs | `Verified` |
| `AC-08` | `FR-04` | Test Model Guard | Passing `--test` enforces only the cheapest test models and rejects expensive models | `Verified` |
| `AC-09` | `FR-01` | Preview Alias | `init --preview` previews like `--dry-run`, and `init --apply` installs like plain `init` | `Verified` |
| `AC-10` | `FR-01` | Empty Tool List | `init --engine=` is rejected and nothing is written | `Verified` |
| `AC-11` | `FR-02` | Stale Skill Cleanup | Re-running `init` removes the managed link of a skill the new version no longer ships | `Verified` |
| `AC-12` | `FR-03` | Foreign Links Kept | `uninstall` leaves a user's own link at a `faber-*` path in place | `Verified` |
| `AC-13` | `FR-03` | Honest Status | `status` reports a folder FaberSEP Spec does not own as not managed | `Verified` |
| `AC-14` | `FR-03` | Linked Checkout Status | After `init --link`, `status` reports the tools as linked to the checkout | `Verified` |
| `AC-15` | `FR-02` | Valid Plugin Manifests | Every shipped rule declares a trigger and the Antigravity manifest has at most three suggested prompts | `Verified` |

---

## 2. BDD Authoring Rules

1. Describe observable developer and CLI outcomes — never internal code identifiers.
2. Keep each scenario atomic (one verifiable outcome).
3. State exact observable outputs and file locations.

---

## 3. Detailed BDD Scenarios

### Group A: Auto-Detection & Multi-Agent Installation

#### Scenario AC-01: Auto-detection of installed AI coding tools
- **GIVEN:** A user home directory containing Antigravity and Claude configuration folders, but no Codex or Cursor folders
- **WHEN:** The installer inspects the user's environment
- **THEN:** Antigravity and Claude Code / Desktop are reported as detected AND OpenAI Codex and Cursor are reported as not detected.

#### Scenario AC-02: Non-destructive dry-run preview
- **GIVEN:** A clean user home directory with detected AI coding tools
- **WHEN:** The developer runs `faber-spec init --yes --dry-run`
- **THEN:** The command exits with status 0, prints the planned canonical store and target paths, AND writes no files or links to disk.

#### Scenario AC-03: Canonical staging and multi-agent wiring
- **GIVEN:** A user home directory with Antigravity, Claude Code, Codex, and Cursor selected
- **WHEN:** The developer runs `faber-spec init --engine antigravity,claude-code,codex,cursor`
- **THEN:** `~/.faber/spec/` contains the rules, templates, manifests, and all five `faber-*` skills, Antigravity and Claude Code receive plugin links, AND Codex and Cursor receive individual links for every `faber-*` skill.

#### Scenario AC-04: Unmanaged directory backup protection
- **GIVEN:** An existing non-FaberSEP directory at the Antigravity plugin target path
- **WHEN:** The developer runs `faber-spec init --engine antigravity`
- **THEN:** The existing directory is moved to a timestamped `.bak` path before the `faber-spec` link is created AND no user files are deleted.

#### Scenario AC-05: Universal rule and template path resolution
- **GIVEN:** All five `faber-*` skills installed either as a plugin or as standalone per-skill folders
- **WHEN:** The skill instructions are inspected
- **THEN:** Every skill uses the `faber-` prefix AND references both relative plugin paths and `~/.faber/spec/` fallback paths for governance rules and templates.

### Group B: Status, Uninstall & Cross-Model Discuss

#### Scenario AC-06: Status reporting and clean uninstall
- **GIVEN:** FaberSEP Spec is installed into one or more AI coding tools
- **WHEN:** The developer runs `faber-spec status` followed by `faber-spec uninstall`
- **THEN:** `status` reports the installed version and linked tools AND `uninstall` removes the managed links and `~/.faber/spec/` while leaving all project `docs/` folders untouched.

#### Scenario AC-07: Strict read-only reviewer commands
- **GIVEN:** A `faber-discuss` round targeting either the `agy` or `claude` reviewer CLI
- **WHEN:** The reviewer invocation command is constructed
- **THEN:** File-editing and shell-execution tools are explicitly denied AND only read-only file inspection is permitted.

#### Scenario AC-08: Cheapest-model guard in test mode
- **GIVEN:** A developer testing `faber-discuss` with `--test`
- **WHEN:** A non-test flagship model is requested
- **THEN:** The command is rejected with an error listing the allowed cheapest test models.

### Group C: Safe Updates, Ownership & Previews (v0.2.1)

#### Scenario AC-09: Preview and apply aliases
- **GIVEN:** A user home directory with a detected AI coding tool
- **WHEN:** The developer runs `faber-spec init --yes --preview`, and later `faber-spec init --yes --apply`
- **THEN:** The preview run exits 0 and writes nothing to disk, AND the `--apply` run installs exactly like `faber-spec init --yes`.

#### Scenario AC-10: Empty tool list is rejected
- **GIVEN:** Any user home directory
- **WHEN:** The developer runs `faber-spec init --engine=`
- **THEN:** The command exits non-zero with the list of supported tools AND writes nothing to disk.

#### Scenario AC-11: Removed skills leave no broken links
- **GIVEN:** Codex holds a FaberSEP Spec link for a skill the current version no longer ships
- **WHEN:** The developer re-runs `faber-spec init` for Codex
- **THEN:** That skill's link is removed AND every skill the current version ships is linked.

#### Scenario AC-12: A user's own link is never removed
- **GIVEN:** A link the user made at a `faber-*` skill path that points to a folder outside FaberSEP Spec
- **WHEN:** The developer runs `faber-spec uninstall`
- **THEN:** The user's link and the folder it points to are left in place.

#### Scenario AC-13: Status does not claim foreign folders
- **GIVEN:** A folder that FaberSEP Spec did not create sits at the Claude Code plugin path
- **WHEN:** The developer runs `faber-spec status`
- **THEN:** Claude Code is reported as not managed, not as installed.

#### Scenario AC-14: Status after a contributor link install
- **GIVEN:** The developer ran `faber-spec init --link` from a local checkout
- **WHEN:** The developer runs `faber-spec status`
- **THEN:** The selected tools are reported as installed AND the source is reported as the linked checkout, not as "not installed".

#### Scenario AC-15: Plugin manifests pass the tools' validators
- **GIVEN:** The packaged plugin
- **WHEN:** Its manifests and rules are inspected
- **THEN:** Every rule file declares a trigger AND the Antigravity manifest lists at most three suggested prompts.
