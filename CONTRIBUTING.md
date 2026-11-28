# Contributing to FaberSEP Spec

Thanks for helping. Bug reports, doc fixes and pull requests are all welcome.

## Report a bug

[Open an issue](https://github.com/fabersep/spec/issues) with:

- what you ran and what you expected;
- the output of `npx @fabersep/spec --version` and `npx @fabersep/spec status`;
- which AI coding tool you use, your OS and your Node.js version.

## Make a change

```bash
git clone https://github.com/fabersep/spec.git
cd spec
npm test
node src/cli.mjs init --link   # point your AI tools at this checkout while you work
```

- **Specs come first.** This repository uses its own standard: behavior is defined in `docs/features/<NN>-<slug>/prd.md` and `acceptance_criteria.md`. A change in behavior updates its spec in the same pull request; a new capability gets a new feature folder.
- **Zero runtime dependencies.** The installer uses only Node.js built-ins; the `faber-discuss` helpers use only the Python 3 standard library.
- **Zero idle tokens.** Nothing may load into an agent's context until a skill is invoked: no always-on rules, no instruction files written into the user's repositories.
- **Tests:** `npm test` runs the Node installer tests and the Python `faber-discuss` tests. Add a test for every fix or scenario, named after its `AC-XX`.
- **Versions:** `package.json`, `plugin.json`, `.claude-plugin/plugin.json` and the rules' `version` move together; a test checks the manifests.
- **Docs:** the README is for non-technical users and tells the story; technical detail goes in `docs/guide.md`. Add a line to `CHANGELOG.md` under the unreleased version.

## License

By contributing you agree that your contribution is licensed under [Apache-2.0](LICENSE).
