# FaberSEP Spec — User Guide and Reference

The [README](../README.md) tells you what FaberSEP Spec is and how to start. This guide holds the technical detail: what gets installed where, every command and flag, how each skill works, and how to update, remove or hack on it.

- [What gets installed](#what-gets-installed)
- [Supported AI coding tools](#supported-ai-coding-tools)
- [Commands and flags](#commands-and-flags)
- [The documents it writes](#the-documents-it-writes)
- [The skills](#the-skills)
- [faber-discuss in detail](#faber-discuss-in-detail)
- [Updating and removing](#updating-and-removing)
- [Safety: what it never touches](#safety-what-it-never-touches)
- [Working from source](#working-from-source)
- [Troubleshooting](#troubleshooting)

---

## What gets installed

`npx @fabersep/spec init` does two things:

1. **Stages one copy** of the package in `~/.faber/spec/`: the documentation rules (`rules/`), the four templates (`templates/`), the five `faber-*` skills (`skills/`), both plugin manifests (`plugin.json` for Antigravity, `.claude-plugin/plugin.json` for Claude Code) and a marker file `.faber-spec-meta.json` with the version and skill list.
2. **Links each selected tool** to that copy: a plugin link for Antigravity and Claude Code, one link per skill for Codex and Cursor. Where the system does not allow links (for example Windows without developer mode), it copies the files instead and says `copy`.

Nothing is written into your project repositories. Skills write only the `docs/` files you ask them for.

## Supported AI coding tools

| Tool | Detected by | Installed at | Layout |
| :--- | :--- | :--- | :--- |
| **Antigravity** | `~/.gemini` | `~/.gemini/config/plugins/faber-spec` | Plugin (`plugin.json`, skills, rules) |
| **Claude Code** (CLI and desktop app) | `~/.claude` | `~/.claude/skills/faber-spec` | Plugin (`.claude-plugin/plugin.json`, skills) |
| **OpenAI Codex** | `~/.codex` | `~/.codex/skills/faber-*` | One link per skill |
| **Cursor** | `~/.cursor` | `~/.cursor/skills/faber-*` | One link per skill |

Each skill finds the rules and templates next to itself (`../../rules/`, `../../templates/`) and falls back to `~/.faber/spec/`, so plugin and per-skill layouts behave the same.

To check that a tool really loads the plugin:

```bash
agy plugin list                     # Antigravity: faber-spec (enabled), 5 skills, 1 rule
claude plugin validate ~/.faber/spec  # Claude Code: lists the 5 faber-spec:* skills
```

## Commands and flags

| Command | What it does |
| :--- | :--- |
| `npx @fabersep/spec init` | Finds your AI tools, shows a checklist (found tools pre-ticked) and installs. Unticking an installed tool removes it. |
| `npx @fabersep/spec init --yes` | Installs into every found tool without asking. |
| `npx @fabersep/spec init --engine <list>` | Installs into the tools you name: `antigravity`, `claude-code`, `codex`, `cursor` (comma-separated). |
| `npx @fabersep/spec init --preview` | Shows what would change and writes nothing. `--dry-run` is the same. |
| `npx @fabersep/spec init --apply` | Same as plain `init` (kept for scripts written for other FaberSEP tools). |
| `npx @fabersep/spec init --link` | Links your tools to the current checkout instead of `~/.faber/spec/` (for contributors). |
| `npx @fabersep/spec init --undo` | Same as `uninstall`. |
| `npx @fabersep/spec status` | Shows the installed version, the skills and each tool's state: `installed`, `detected (not linked)`, `not detected`, or `not managed` when a folder FaberSEP Spec did not create sits at its path. |
| `npx @fabersep/spec uninstall [--engine <list>]` | Removes FaberSEP Spec from all tools (or the ones named); removes `~/.faber/spec/` once no tool uses it. |
| `npx @fabersep/spec --version` | Prints the version. |

Keys in the checklist: `↑`/`↓` move, `Space` toggles, `a` toggles all, `Enter` installs, `q`/`Esc`/`Ctrl+C` cancels without changes.

## The documents it writes

FaberSEP Spec keeps three kinds of truth apart, each in its own file:

| File | Answers | Written by |
| :--- | :--- | :--- |
| `docs/architecture.md` | **How** the system is built: modules, data flow, entry points, checked against the code | `faber-init-arch` |
| `docs/master-prd.md` | **What** the product does and **why**: users, journeys, capabilities, non-goals (`NG-XX`), gaps (`GAP-XX`) | `faber-init-prd` |
| `docs/features/<NN>-<slug>/prd.md` | One feature's requirements (`FR-XX`), edge cases and non-goals | `faber-new-feature`, `faber-extract-features` |
| `docs/features/<NN>-<slug>/acceptance_criteria.md` | How to check that feature: atomic `GIVEN / WHEN / THEN` scenarios (`AC-XX`), each mapped to an `FR-XX` | `faber-new-feature`, `faber-extract-features` |
| `docs/features/README.md` | Index of all features | `faber-extract-features`, `faber-new-feature` |

The full rule set is in [`rules/documentation-rules.md`](../rules/documentation-rules.md); the templates are in [`templates/`](../templates/). Two rules matter most: skills verify real files before writing (evidence first), and whatever they cannot verify is written down as a `GAP-XX` instead of guessed.

## The skills

| Skill | Use it when | Output |
| :--- | :--- | :--- |
| `faber-init-arch` | Documenting an existing codebase, or drafting the architecture of a new one | `docs/architecture.md` |
| `faber-init-prd` | Writing down the product's vision, users, journeys, non-goals and KPIs | `docs/master-prd.md` |
| `faber-extract-features` | Bringing an existing repository up to the standard, feature by feature | `docs/features/README.md` + one `prd.md` and `acceptance_criteria.md` per feature |
| `faber-new-feature` | Before building something new: it asks 3–5 questions, then writes the spec | `docs/features/<NN>-<slug>/{prd.md, acceptance_criteria.md}` |
| `faber-discuss` | A second opinion from another AI model on a design and its spec | Review ledger + reviewed PRD and BDD |

Skills load only when you call them, so they cost no tokens in a chat that does not use them. If [FaberSEP Atlas](https://github.com/fabersep/atlas) is connected as an MCP server, `faber-init-arch`, `faber-init-prd` and `faber-extract-features` use its code map and read far fewer files.

## faber-discuss in detail

`faber-discuss` runs only when you ask for it. Your current agent (the **author**) briefs a second model through its CLI (the **reviewer**: `agy` for Gemini models, `claude` for Claude models) and they go through numbered findings (`F-1`, `F-2`, …) round by round.

- **Read-only reviewer.** The reviewer may read files; writing, editing, shell commands, subagents and web access are denied (`agy`: a permission deny list; `claude`: plan mode with only `Read`, `Glob`, `Grep`).
- **Two phases.** Phase 1 discusses the design; phase 2 writes the PRD and BDD and has the reviewer check them against the decisions.
- **Budgets.** Default 5 rounds per phase and 500K uncached tokens in total; you can change both (`"claude opus, 3 rounds, 300K"`).
- **Ledger.** Every prompt, reply, ruling and token count is saved under `docs/reviews/YYYY-MM-DD-<reviewer>-<topic>/` (or `records/external-reviews/` if that folder exists), with `decisions.md`, `stats.md` and `summary.md`.
- **The end.** You get a short summary to approve with yes or no, numbered owner questions (`OQ-n`) with recommended answers, and the stats.
- **Testing the skill** passes `--test`, which allows only the cheapest models (`gemini-3.8-flash-low` / `haiku`).

Needs Python 3 and the reviewer's CLI (`agy` or `claude`) signed in.

## Updating and removing

```bash
npx @fabersep/spec@latest init --yes   # update: refreshes ~/.faber/spec/, keeps the links
npx @fabersep/spec uninstall           # remove from every tool and delete ~/.faber/spec/
npx @fabersep/spec uninstall --engine cursor   # remove from one tool only
```

When a newer version drops a skill, `init` removes its old link from Codex and Cursor. Start a new chat in your AI tool after updating so it loads the new skills.

## Safety: what it never touches

- **Your repositories.** `init` and `uninstall` never write to or delete anything in a project; `docs/` folders stay as they are.
- **Folders and links that are not its own.** A path counts as FaberSEP Spec's only when it (or the folder a link points to) has the `.faber-spec-meta.json` marker, the `faber-spec` plugin manifest, or a `faber-*` skill. Anything else at a target path is moved to `<path>.bak.<timestamp>` before `init` links, and `uninstall` leaves it alone.
- **Other packages' `faber-*` skills.** The update cleanup removes only links into FaberSEP Spec's own store.

## Working from source

```bash
git clone https://github.com/fabersep/spec.git
cd spec
npm test                      # Node installer tests + Python faber-discuss tests
node src/cli.mjs init --link  # your tools now read this checkout directly
node src/cli.mjs status       # shows "Linked checkout: <path>"
```

See [CONTRIBUTING.md](../CONTRIBUTING.md) for the rules (specs first, zero dependencies, zero idle tokens).

## Troubleshooting

| What you see | What to do |
| :--- | :--- |
| `No supported AI coding tools were auto-detected` | Name the tool: `npx @fabersep/spec init --engine claude-code`. |
| The skills don't show up in your AI tool | Start a new chat (or restart the tool). Then run `npx @fabersep/spec status`. |
| `status` says `not managed` | Something else is at that path. Run `init` for that tool: it moves the folder to a `.bak` backup and links FaberSEP Spec. |
| `backed up previous directory to: …` | `init` found a folder it did not create and kept it there. Look inside; delete it when you no longer need it. |
| `faber-discuss` stops with a quota or sign-in error | Sign in to the reviewer's CLI (`agy` or `claude`) and run it again. |

Still stuck? [Open an issue](https://github.com/fabersep/spec/issues).
