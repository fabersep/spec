---
name: faber-init-prd
description: Synthesize docs/master-prd.md (product vision, personas, core user journeys, capabilities, non-goals, KPIs, and gaps) for the current repository using the FaberSEP Master PRD template. Use when creating or refreshing a project's Master PRD, or when the user runs faber-init-prd.
---

# faber-init-prd — Master PRD Synthesis

Generate or refresh `docs/master-prd.md` in the active repository, defining **WHAT** the product does and **WHY** in clear, domain-authentic product language.

## Step 1: Load Rules and Template

Read these two files relative to this `SKILL.md` before writing anything:
1. `../../rules/documentation-rules.md`
2. `../../templates/master-prd.md`

## Step 2: Gather Ground Truth

1. **Read `docs/architecture.md` first** if it exists (recommend running `faber-init-arch` first for brownfield codebases if it is missing, or inspect the codebase directly if the user wants to proceed immediately).
2. **Inspect project context:** Read `README.md`, `ROADMAP.md` (if present), package manifest, and existing `docs/features/` (if any).
3. **Use Atlas MCP if available** (`map`, `hubs`) to verify major user-facing capabilities and entry points when documenting an existing codebase.
4. **Greenfield mode:** If the repository has no code or README yet, ask the user 3–5 focused questions (problem, primary persona, core workflow, non-goals, target platform) before drafting.

## Step 3: Write `docs/master-prd.md`

- Write directly to `<workspace>/docs/master-prd.md`. Never copy template or rule files into the user's repository.
- Follow `templates/master-prd.md` strictly:
  - Keep it **product-centric ("WHAT & WHY")**, not a repetition of low-level code details from `docs/architecture.md`.
  - Tailor personas, journeys, constraints, and KPIs to the actual product archetype (CLI, library, MCP server, API, web/mobile app, plugin). Do not inject irrelevant mobile/monetization boilerplate into non-applicable projects.
  - Number all non-goals (`NG-01`, `NG-02`, ...) and context gaps (`GAP-01`, `GAP-02`, ...).
  - Set frontmatter `last_updated` to today's date (`YYYY-MM-DD`) and `status: draft`.

## Definition of Done

- [ ] `docs/master-prd.md` exists and follows `templates/master-prd.md`.
- [ ] Personas, journeys, capabilities, and constraints accurately reflect the real product domain.
- [ ] Non-goals (`NG-XX`) and gaps (`GAP-XX`) are explicit and numbered.
- [ ] Zero hallucinated metrics/formulas and zero unresolved placeholders (`<...>`, `{{...}}`, `[TODO]`).
- [ ] Present a concise key-point summary of the draft Master PRD so the owner can approve or adjust it quickly.
