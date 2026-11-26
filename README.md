# FaberSEP Spec

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](LICENSE)

**Spec-driven engineering templates and agent skills — without dumping boilerplate into your repo.**

FaberSEP Spec gives AI coding agents a disciplined, evidence-first documentation workflow:

1. **Architecture (`docs/architecture.md`)** — *How the system is actually built*, grounded in code.
2. **Master PRD (`docs/master-prd.md`)** — *What the product does and why*, in plain domain language.
3. **Feature Specs (`docs/features/<NN>-<slug>/prd.md` + `acceptance_criteria.md`)** — Functional requirements (`FR-XX`) paired with atomic `GIVEN / WHEN / THEN` BDD scenarios (`AC-XX`).

Installed as a global agent plugin, it adds **zero template or config clutter** to your project repository — only the clean `docs/` you generate.

> **Status:** `v0.1.0` — Antigravity plugin ready. Claude Code plugin manifest and optional thin MCP server (`@fabersep/spec mcp`) for Cursor/Windsurf and deterministic spec validation are planned next.

---

## Included Skills (`v0.1.0`)

All skills are prefixed with `faber-` to avoid naming collisions with other plugins.

| Skill | Purpose |
| :--- | :--- |
| `faber-init-arch` | Reverse-engineer `docs/architecture.md` from an existing codebase (uses [Atlas](https://github.com/fabersep/atlas) MCP automatically if available) or draft one for a new project. |
| `faber-init-prd` | Synthesize `docs/master-prd.md` from architecture and codebase reality (or a greenfield idea). |
| `faber-extract-features` | Scan an existing codebase and generate `docs/features/<NN>-<slug>/prd.md` + `acceptance_criteria.md` plus `docs/features/README.md`. |
| `faber-new-feature` | Clarify a new feature idea (3–5 focused questions) and generate its `prd.md` and BDD `acceptance_criteria.md` before coding. |

---

## Install (Antigravity)

Clone or symlink this repository into Antigravity's global plugins directory:

```bash
git clone https://github.com/fabersep/spec.git ~/.gemini/config/plugins/faber-spec
```

*(For local development, you can symlink your working copy instead: `ln -s /path/to/spec ~/.gemini/config/plugins/faber-spec`.)*

Antigravity discovers the plugin automatically on the next turn. Open **Customizations** to enable or disable **FaberSEP Spec** as a single unit.

### Quick Start in Any Project

1. Open your repository in Antigravity.
2. Ask the agent:
   - *"Run `faber-init-arch` to document this repo's architecture."*
   - *"Run `faber-init-prd` to generate the Master PRD."*
   - *"Run `faber-extract-features` to extract existing feature PRDs and BDDs."*
   - *"Run `faber-new-feature` for `<your feature idea>`."*

---

## Repository Structure

```text
spec/
├── plugin.json                        # Antigravity plugin manifest
├── rules/
│   └── documentation-rules.md         # Core spec-driven invariants (loaded on demand by skills)
├── templates/
│   ├── architecture.md                # Project-agnostic architecture template
│   ├── master-prd.md                  # Project-agnostic Master PRD template
│   ├── feature-prd.md                 # Feature PRD template (FR-XX)
│   └── feature-bdd.md                 # Given-When-Then BDD template (AC-XX)
├── skills/
│   ├── faber-init-arch/SKILL.md
│   ├── faber-init-prd/SKILL.md
│   ├── faber-extract-features/SKILL.md
│   └── faber-new-feature/SKILL.md
└── docs/                              # FaberSEP Spec's own dogfooded documentation
    ├── architecture.md
    ├── master-prd.md
    └── features/
```

---

## Works Great With

- **[FaberSEP Atlas](https://github.com/fabersep/atlas)** — Deterministic AST code map & MCP server. When Atlas MCP is connected, `faber-init-arch`, `faber-init-prd`, and `faber-extract-features` automatically use it to map the codebase with far fewer tokens.
- **[FaberSEP Blueprints](https://fabersep.dev)** — Build-verified project scaffolds and recipes.

## License

Apache-2.0 — see [LICENSE](LICENSE).
