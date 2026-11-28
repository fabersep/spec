# FaberSEP Spec

[![npm](https://img.shields.io/npm/v/@fabersep/spec.svg)](https://www.npmjs.com/package/@fabersep/spec)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](LICENSE)

**Your AI coding assistant builds what it guesses you meant. FaberSEP Spec has it write down what you mean first, in short documents you can read, approve and keep.**

<!-- Video: a 60-second walkthrough will go here. -->

---

## The problem you already know

You ask your AI assistant: *"Add a way for users to export their data."* Ten minutes later it has written 400 lines. It picked CSV when you wanted JSON, it exports everyone's data instead of only the user's own, and it changed a file you didn't want touched.

So you explain again. And again in the next chat, because it forgot. A month later nobody, human or AI, can say what the export feature is supposed to do, because the only record is the code itself.

Asking it to "write a spec first" helps a little, but every time you get a different format. Sometimes it describes functions that don't exist.

## What changes with FaberSEP Spec

The same request, with FaberSEP Spec:

1. **Your assistant asks before it builds.** Three to five short questions, each with a suggested answer: *"Only the signed-in user's data? JSON or CSV? What if they have none?"*
2. **It writes a one-page spec.** What the feature does, what it explicitly won't do, and a list of checks in plain language: *"GIVEN a user with no data, WHEN they export, THEN they get an empty file and a short note."*
3. **You read a short summary and say yes or no.** Only then does the code get written, and it gets checked against that list.

The spec stays in your project's `docs/` folder. Next month, the next chat, or a different AI tool reads the same page and knows what the feature is for.

## Why you can trust it

- **It checks before it writes.** When it documents an existing project, it reads the real files first. What it can't confirm, it lists as an open question instead of making it up.
- **Same shape every time.** Every project gets the same few documents, so you always know where to look.
- **Your projects stay clean.** It is installed once on your computer. Nothing is added to your repositories except the documents you ask for.
- **It costs nothing until you use it.** The instructions load only when you call one of its skills, so everyday chats stay as fast and cheap as before.
- **Works with the tools you already use:** Claude Code, Antigravity, OpenAI Codex and Cursor. Switch tools and the documents still mean the same thing.
- **Free and open source** (Apache-2.0). No account and no server: it runs inside the AI tool you already use.

---

## Get started (about 2 minutes)

You need **Node.js 20 or newer**. To check, run `node -v` in a terminal.

**1. Install it**

```bash
npx @fabersep/spec init
```

It finds the AI tools on your computer and shows them as a checklist, already ticked. Press `Enter`. That's all. It keeps a backup of anything it would replace, and you can remove it any time with `npx @fabersep/spec uninstall`.

Want to see what it would do first? Run `npx @fabersep/spec init --preview`: nothing is written.

**2. Check it**

```bash
npx @fabersep/spec status
```

Your tools should say `installed`.

**3. Start a new chat in your AI tool and try it**

For something new you want to build:

> *"Run faber-new-feature for: users can export their data."*

It asks its questions, then writes `docs/features/01-data-export/prd.md` (what and why) and `acceptance_criteria.md` (how to check it). Read the summary it gives you and answer yes, or tell it what to change.

**Already have a project with code?** Ask it to describe what is there, in this order:

> *"Run faber-init-arch."* → `docs/architecture.md`: how the project is built.
>
> *"Run faber-init-prd."* → `docs/master-prd.md`: what the product does and for whom.
>
> *"Run faber-extract-features."* → one short spec per existing feature.

---

## A normal day with it

- **Before building something:** *"Run faber-new-feature for …"*. Answer the questions, approve the summary.
- **While building:** your assistant works against the checklist in the spec, and you can ask it *"Which checks pass?"*.
- **For a big or risky change:** *"Run faber-discuss on this design."* A second AI model (for example Gemini reviewing Claude's plan) looks for holes. You get a short summary and a few numbered questions to answer.
- **When the project changes shape:** run `faber-init-arch` again; it updates only what changed.

A check in a spec looks like this:

```markdown
#### Scenario AC-03: Export with no data
- **GIVEN:** A signed-in user who has no saved items
- **WHEN:** They choose "Export my data"
- **THEN:** They receive an empty JSON file AND see the note "Nothing to export yet".
```

---

## Common questions

**Do I need to know how to write specs?**
No. The assistant asks you plain questions and writes the document. You only read the summary and say yes or no.

**Does it slow down my assistant or cost more?**
No. It stays out of the way until you call one of its skills.

**What does it put in my project?**
Only Markdown files under `docs/`. You can edit or delete them like any other file.

**Does it work without code yet, for a brand-new idea?**
Yes. `faber-init-prd` and `faber-new-feature` ask you about the idea and write the documents from your answers.

**How do I update or remove it?**
`npx @fabersep/spec@latest init --yes` updates it. `npx @fabersep/spec uninstall` removes it and leaves your `docs/` folders alone. See [Updating and removing](docs/guide.md#updating-and-removing).

**Something went wrong.**
Run `npx @fabersep/spec status` first. Then check [Troubleshooting](docs/guide.md#troubleshooting) or [open an issue](https://github.com/fabersep/spec/issues).

---

## Going further

- **[User guide and reference](docs/guide.md):** what is installed where, every command and flag, the documents and skills in detail, how `faber-discuss` works.
- **[How this project is specified](docs/features/README.md):** FaberSEP Spec is documented with its own standard ([Master PRD](docs/master-prd.md), [architecture](docs/architecture.md)).
- **[Contributing](CONTRIBUTING.md)** and **[Changelog](CHANGELOG.md)**.

Works well with **[FaberSEP Memory](https://github.com/fabersep/memory)** (your assistant remembers the rules you approve, across tools) and **[FaberSEP Atlas](https://github.com/fabersep/atlas)** (a code map that lets the skills read far fewer files). Each one also works on its own.

FaberSEP Spec is part of [FaberSEP](https://github.com/fabersep), open-source tools that help AI coding assistants work with more discipline.

## License

[Apache-2.0](LICENSE)
