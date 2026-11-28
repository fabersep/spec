---
name: faber-discuss
description: Cross-model second-opinion design and spec review loop, started only when the user explicitly requests it ("faber-discuss", "discuss", /faber-discuss). The active agent (author) briefs an external read-only reviewer CLI (reviewer), loops on numbered findings until they close, drafts the PRD and BDD using FaberSEP templates and rules, has them reviewed in the same reviewer conversation, and finishes with a key-point summary and owner questions.
---

# faber-discuss — Cross-Model Design & Spec Review

Run a structured, read-only second-opinion loop with an external reviewer CLI (`agy` or `claude`) before writing code.

**Hard guardrails:**
- Start **only** when the user explicitly asks to run `faber-discuss` / `discuss` (never on your own initiative).
- Respond to the user in the user's language; write every ledger file, brief, prompt, and spec in English (quoting the user's own constraints verbatim with an English gloss).
- Never let the reviewer edit files, run shell commands, or launch subagents/workflows.
- Never approve a spec, commit, push, or move task-tracker items inside this skill.
- **Testing the skill itself:** always pass `--test` to `discuss_round.py` so only the cheapest test model is used (`gemini-3.8-flash-low` for `agy`, `haiku` for `claude`).

---

## Step 1: Load Governance Rules and Templates

Locate the plugin root relative to this `SKILL.md` (`../..`, or `~/.faber/spec/` when installed as a standalone skill in Codex/Cursor), and keep these paths ready for Phase 2 (`spec`):
1. `../../rules/documentation-rules.md` (fallback: `~/.faber/spec/rules/documentation-rules.md`)
2. `../../templates/feature-prd.md` (fallback: `~/.faber/spec/templates/feature-prd.md`)
3. `../../templates/feature-bdd.md` (fallback: `~/.faber/spec/templates/feature-bdd.md`)

The helper scripts `discuss_round.py` and `discuss_log.py` live directly alongside this `SKILL.md` (and at `~/.faber/spec/skills/faber-discuss/`).

Check the active repository's entry file (`AGENTS.md` or `CLAUDE.md`) and `docs/` layout so generated specs follow project conventions.

---

## Step 2: Parse Arguments and Defaults

The user may give arguments in any order or as natural language (for example: `"claude opus, 3 rounds, 300K, phase=discuss"` or `"neon medium, 4 tur"`). Before Round 1, confirm in one short line what you understood (`reviewer cli/model, rounds, budget, phase1 cap, phase, topic`); ask only if a value is unclear.

| Argument | Default | Rule |
| :--- | :--- | :--- |
| `cli` | Cross-vendor opposite of `author` (`claude` if author is Antigravity; `agy` if author is Claude) | Supported: `agy`, `claude` |
| `model` | `opus` (if `cli=claude`) / `gemini-4-neon-medium` (if `cli=agy`) | With `--test`: cheapest only (`haiku` / `gemini-3.8-flash-low`) |
| `rounds` | `5` per phase | Hard cap per phase |
| `budget` | `500000` uncached tokens total | `input + output` (including cache write); cache reads logged separately |
| `phase1` | Half of `budget` | Remaining budget goes to Phase 2 |
| `phase` | `both` | `discuss` stops after Phase 1; `spec` skips Phase 1 (requires an earlier `decisions.md`) |
| `topic` | Short slug from current subject | Used for the ledger directory name |
| `ledger` | `records/external-reviews/YYYY-MM-DD-<reviewer>-<topic>/` if `records/external-reviews/` exists, else `docs/reviews/YYYY-MM-DD-<reviewer>-<topic>/` | Append `-2`, `-3` if the folder already exists |

Create `<ledger>/README.md` first (arguments, start time, author and reviewer pair).

Initialize the run record before Round 1:
```bash
python3 <plugin_dir>/skills/faber-discuss/discuss_log.py init <ledger> \
  --topic <topic> --scenario <topic> \
  --author-model <author-model> --author-effort <effort> \
  --reviewer-cli <cli> --reviewer-model <model> \
  --budget <N> --rounds <N> --phase <phase> --repo <repo-path>
```

---

## Step 3: Running Each Round

1. Write the exact prompt to `<ledger>/p<phase>-r<n>-prompt.md`.
2. Execute `discuss_round.py` from the repository root (allow up to 600s command timeout):
   ```bash
   python3 <plugin_dir>/skills/faber-discuss/discuss_round.py <ledger> p<phase>-r<n> \
     --cli <cli> --model <model> [--conversation <id>] [--add-dir <path>] [--timeout 540] [--test]
   ```
3. Handle exit codes:
   - `0`: Read `<ledger>/p<phase>-r<n>-reply.md` in full. Check token totals against the phase budget and round cap.
   - `2` (quota/auth error): Stop immediately and jump to Step 6 (**End**).
   - `5` (reviewer failed to resume `--conversation` and opened a new ID): Inform the user immediately (old ID vs new ID, history lost), switch to the **Cold / New Conversation** packet built from `decisions.md` + open items, and record the new ID in `<ledger>/README.md`.
   - `3` or `4` (timeout or missing findings/`VERDICT`): Retry once (for `4`, remind the reviewer of the exact answer format). A second failure ends the run and hands open items to the user.

### Cache and Cost Discipline
- Prompt caches expire quickly (observed ~7 minutes warm window on `agy`). Rule findings quickly using targeted reads (`grep` or line ranges) instead of re-reading entire files, and send the next round within 7 minutes.
- If >7 minutes passed and previous input exceeded 30K tokens (cold cache or `continue`), start a fresh reviewer conversation (omit `--conversation`) with a compact packet: role, decision table, open IDs, and only the excerpts needed for those open IDs.
- Estimate each round's cost before sending it (warm: prompt + reply; cold resume: last input; fresh packet: system overhead + packet) and skip the round if it would exceed remaining budget.

---

## Step 4: Phase 1 — Design Discussion (`discuss`)

**Round 1 prompt (`p1-r1-prompt.md`) structure (do NOT paste raw chat transcript):**
1. **Role:** `"You are the second reviewer in a design discussion. Find what is wrong, missing, or unclear; do not agree to be polite. Read files from disk; do not edit files, run commands, or use subagents, workflows, schedules, or web search."`
2. **Goal:** What we are designing and why (a few sentences).
3. **Decided so far:** Numbered list.
4. **Ruled out:** Option, who ruled it out, why.
5. **Owner constraints:** User's exact words verbatim (plus English gloss if not English).
6. **Open points:** Unresolved questions or trade-offs.
7. **Files worth reading:** Specific absolute paths and relevant line ranges (never "read the whole repo").
8. **Owner-decision boundary:** Money/billing, store/console, user-visible product changes, scope, and data deletion belong to the project owner — list them under `## Owner questions` (`OQ-n`), never decide them.
9. **Answer format:**
   - Findings as `F-n [BLOCKER|MAJOR|MINOR] [OPEN|CLOSED]` with **Claim**, **Evidence** (quote or `path:line`), and **Proposed change** (at most 12 per round).
   - Separate `## Owner questions` (`OQ-n`) section.
   - Final line: `VERDICT: CONTINUE | DONE` (limit ~800 words).

**Author Rulings & Round N > 1:**
- Verify each finding against the actual files on disk before ruling.
- Record every ruling via `discuss_log.py rule <ledger> <round-tag> F-n --ruling ACCEPT|REJECT|PARTIAL|OWNER|SETTLED --reason valid|wrong-claim|out-of-scope|already-covered|owner-decides --note "<one line>"`. (Use `--by owner` when the user rules directly.)
- Round `N > 1` prompt opens with the ruling table (`ID | ruling | reason or change`) plus any verbatim owner answers, then instructs: `"Reply only on rulings you contest and on new BLOCKER or MAJOR items. Mark accepted IDs CLOSED. Do not reopen OWNER items. New MINOR items only in round 1 of a phase. Before outputting DONE with no findings, confirm you checked edge cases, failure modes, the project entry file (AGENTS.md / CLAUDE.md), and owner constraints."`

**Phase 1 Stop Rules:**
- Stop when `VERDICT: DONE` and zero `BLOCKER`/`MAJOR` findings remain `OPEN`, or at the round cap / Phase 1 budget.
- **Stalemate:** Any finding still `OPEN` after the author's second `REJECT` becomes `STALEMATE` and moves to the owner list.
- Write `<ledger>/decisions.md` (decision table of closed IDs, owner questions, stalemates).
- If any `BLOCKER` sits in `OWNER` or `STALEMATE`, stop here, jump to **End**, and instruct the user to rerun with `phase=spec` after deciding.

---

## Step 5: Phase 2 — Spec Review (`spec`)

1. Write `docs/features/<NN>-<slug>/prd.md` and `acceptance_criteria.md` (`status: draft`) following `../../rules/documentation-rules.md`, `../../templates/feature-prd.md`, `../../templates/feature-bdd.md`, and any target-repo spec rules. Update `docs/features/README.md`.
2. Before each Phase 2 round, snapshot both files to `<ledger>/snapshots/p2-r<n>-prd.md` and `<ledger>/snapshots/p2-r<n>-acceptance_criteria.md`.
3. **Round 1 prompt** (continuing the same `--conversation` when warm): give exact paths to PRD, BDD, governance rules, and `<ledger>/decisions.md`; instruct `"Read the files from disk, not from your memory of the discussion"`; check:
   - (a) **Traceability:** every Phase 1 decision is in the PRD, every `FR-XX` maps to `AC-XX` scenarios.
   - (b) **Testability:** atomic, observable `GIVEN / WHEN / THEN` with zero code identifiers or placeholders.
   - (c) **Consistency:** PRD, BDD, and project rules agree.
   - (d) **Boundaries:** non-goals and failure modes are explicit.
   Continue finding numbering (`F-n`).
4. **Rounds 2+:** send the ruling table plus `diff -u` against the previous snapshot (`snapshots/p2-r<n-1>-*`).
5. Apply the same stop rules against remaining budget.

---

## Step 6: End of Run

1. Close the log and generate stats/transcript:
   ```bash
   python3 <plugin_dir>/skills/faber-discuss/discuss_log.py end <ledger> --reason done|cap|budget|error|stalemate
   python3 <plugin_dir>/skills/faber-discuss/discuss_log.py stats <ledger>
   ```
2. Write `<ledger>/summary.md` (English).
3. Present to the user (in the user's language):
   - A short key-point summary of the design and spec for a simple `yes` / `no` approval.
   - Numbered owner questions (`OQ-n`) with recommended defaults.
   - Open `MINOR` items.
   - The stats table from `discuss_log.py stats`, the latest `conversation_id`, and how the run ended.

---

## Step 7: Continue (`/faber-discuss continue`)

Syntax: `continue [rounds=2] [budget=100K] [phase=last] [topic] [note]`
- In a new session without `topic`, list recent ledger folders and ask which one to resume — never resume silently.
- Read `<ledger>/decisions.md` and the latest `conversation_id`.
- Quote the user's note verbatim, state which `OQ` or decision it updates, reset stalemate counts for touched IDs, and instruct the reviewer to re-read PRD and BDD from disk.
- Follow the warm/cold rule (>7 min + >30K input -> fresh packet conversation) and finish with Step 6 (**End**).
