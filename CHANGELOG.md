# Changelog

All notable changes to `@fabersep/spec`. Versions follow [Semantic Versioning](https://semver.org/).

## 0.2.1 (unreleased)

### Fixed
- `uninstall` could delete a link you made yourself at a `faber-*` skill path; it now removes only links and folders that FaberSEP Spec created.
- `status` reported any folder at a tool's plugin path as installed; folders FaberSEP Spec did not create now show as `not managed`.
- Updating left broken links behind in Codex and Cursor for skills a newer version no longer ships; `init` now removes them (only its own links, never another package's `faber-*` skills).
- `init --engine=` with an empty list printed "Installed" without wiring any tool; it is now rejected with the list of supported tools.
- After `init --link`, `status` said "not installed"; it now shows the linked checkout and its version.
- Antigravity's `agy plugin validate` rejected the plugin: the documentation rules had no `trigger` (now `manual`, so they still cost zero idle tokens) and the manifest had four suggested prompts where only three are shown.

### Added
- `init --preview` (same as `--dry-run`) shows what would change without writing anything; `--apply` is accepted as an alias of plain `init`, matching `@fabersep/memory` and `@fabersep/atlas`.
- `docs/guide.md` (technical guide and full command reference), `CHANGELOG.md`, `CONTRIBUTING.md` and a CI test workflow.

### Changed
- The README is now a plain-language, story-first introduction; technical detail moved to `docs/guide.md`.

## 0.2.0 (2026-11-27)

- One-command interactive installer (`npx @fabersep/spec init`) for Antigravity, Claude Code, OpenAI Codex and Cursor, with `status` and `uninstall`.
- `faber-discuss`: a read-only, cross-model design and spec review loop (`agy` or `claude` as reviewer).

## 0.1.0 (2026-11-26)

- First release: Antigravity plugin with the documentation rules, four templates and the `faber-init-arch`, `faber-init-prd`, `faber-extract-features` and `faber-new-feature` skills.
