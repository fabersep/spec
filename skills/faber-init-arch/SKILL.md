---
name: faber-init-arch
description: Reverse-engineer (brownfield) or draft (greenfield) a verified docs/architecture.md for the current repository using the FaberSEP architecture template and documentation rules. Use when initializing documentation for a project, refreshing stale architecture docs from code, or when the user runs faber-init-arch.
---

# faber-init-arch — Project Architecture Synthesis

Generate or refresh `docs/architecture.md` in the active repository, grounded strictly in verified codebase evidence (brownfield) or the user's stated design (greenfield).

## Step 1: Load Rules and Template

Read these two files relative to this `SKILL.md` (or from `~/.faber/spec/` if installed as a standalone skill in Codex/Cursor) before inspecting or writing anything:
1. `../../rules/documentation-rules.md` (fallback: `~/.faber/spec/rules/documentation-rules.md`)
2. `../../templates/architecture.md` (fallback: `~/.faber/spec/templates/architecture.md`)

Follow every invariant in `documentation-rules.md` strictly.

## Step 2: Inspect the Repository (Evidence First)

Determine whether the repository already has source code (brownfield) or is empty/new (greenfield).

### Brownfield (Existing Codebase)
1. **Use Atlas MCP if available:** If Atlas MCP tools (`map`, `hubs`, `brief`, `flow`) are connected in this session, call `map` (`zoom: 0` then `zoom: 1` on key directories) and `hubs` first to get a complete structural map with minimal tokens.
2. **Direct inspection (fallback or verification):** Read the repository root listing, package/dependency manifest (`package.json`, `pyproject.toml`, `pubspec.yaml`, `Cargo.toml`, etc.), entry points, CLI/API/MCP definitions, config files, and test setup.
3. **Trace 1–3 core execution flows:** Follow real entry points through core modules to outputs or storage. Verify every file path, exported symbol, CLI flag, or tool name directly in source.
4. **Never guess:** Do not invent infrastructure, layers, or patterns that are not in the codebase. Record missing concerns honestly as `None` or `N/A` and log ambiguities under `GAP-XX`.

### Greenfield (New / Empty Project)
If no source code exists yet, ask the user 3–5 concise questions covering runtime/language, archetype (CLI, library, API, web/mobile app, plugin), storage/external dependencies, and key boundaries. Draft `docs/architecture.md` with `status: draft` and record open decisions under `GAP-XX`.

## Step 3: Write `docs/architecture.md`

- Write directly to `<workspace>/docs/architecture.md` (create `docs/` if needed). Never copy template or rule files into the user's repository.
- Match the structure of `templates/architecture.md`, adapting subsections to the actual project archetype (omit or mark `N/A` any inapplicable interface subsections).
- Set frontmatter `last_updated` to today's date (`YYYY-MM-DD`) and `status: draft`.
- If `docs/architecture.md` already exists, update only the sections that changed and report what was updated.

## Definition of Done

- [ ] `docs/architecture.md` exists and follows `templates/architecture.md`.
- [ ] Every file path, module name, command, and interface mentioned was verified in source (or explicitly marked as greenfield draft).
- [ ] Cross-cutting concerns table is honestly populated (`Implemented`, `Partial`, `None`, or `N/A`).
- [ ] Zero unresolved template placeholders (`<...>`, `{{...}}`, `[TODO]`).
- [ ] Summarize key architectural findings and any `GAP-XX` items for the user to review.
