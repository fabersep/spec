import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  PACKAGE_ROOT,
  detectEngines,
  getCanonicalRoot,
  getPackageVersion,
  getSkillNames,
  getStatus,
  installEngines,
  uninstallEngines,
} from '../src/installer.mjs';

function makeTempHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'faber-spec-test-'));
}

test('AC-01: detectEngines detects present tool directories and marks missing ones false', () => {
  const home = makeTempHome();
  try {
    fs.mkdirSync(path.join(home, '.gemini'), { recursive: true });
    fs.mkdirSync(path.join(home, '.claude'), { recursive: true });

    const detected = Object.fromEntries(detectEngines(home).map((e) => [e.id, e.detected]));
    assert.equal(detected.antigravity, true);
    assert.equal(detected['claude-code'], true);
    assert.equal(detected.codex, false);
    assert.equal(detected.cursor, false);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('AC-02: installEngines dryRun previews without writing files to disk', () => {
  const home = makeTempHome();
  try {
    const res = installEngines({
      engines: ['antigravity', 'codex'],
      userHome: home,
      dryRun: true,
    });
    assert.equal(res.dryRun, true);
    assert.equal(res.results.length, 2);
    assert.equal(fs.existsSync(getCanonicalRoot(home)), false);
    assert.equal(fs.existsSync(path.join(home, '.gemini')), false);
    assert.equal(fs.existsSync(path.join(home, '.codex')), false);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('AC-03: installEngines stages canonical store and wires plugin + per-skill engines cleanly', () => {
  const home = makeTempHome();
  try {
    const expectedSkills = getSkillNames(PACKAGE_ROOT);
    assert.ok(expectedSkills.length >= 5, 'expected at least 5 faber-* skills');

    const res = installEngines({
      engines: ['antigravity', 'claude-code', 'codex', 'cursor'],
      userHome: home,
    });

    const canonical = getCanonicalRoot(home);
    assert.equal(res.canonicalRoot, canonical);
    assert.ok(fs.existsSync(path.join(canonical, 'plugin.json')));
    assert.ok(fs.existsSync(path.join(canonical, '.claude-plugin', 'plugin.json')));
    assert.ok(fs.existsSync(path.join(canonical, 'rules', 'documentation-rules.md')));
    assert.ok(fs.existsSync(path.join(canonical, 'templates', 'architecture.md')));
    assert.equal(
      fs.existsSync(path.join(canonical, 'skills', 'faber-discuss', '__pycache__')),
      false,
      '__pycache__ must not be copied into canonical store',
    );

    // Plugin-mode engines
    const agyTarget = path.join(home, '.gemini', 'config', 'plugins', 'faber-spec');
    const claudeTarget = path.join(home, '.claude', 'skills', 'faber-spec');
    assert.equal(fs.realpathSync(agyTarget), fs.realpathSync(canonical));
    assert.equal(fs.realpathSync(claudeTarget), fs.realpathSync(canonical));

    // Per-skill engines
    for (const skill of expectedSkills) {
      const codexSkill = path.join(home, '.codex', 'skills', skill);
      const cursorSkill = path.join(home, '.cursor', 'skills', skill);
      const expectedTarget = fs.realpathSync(path.join(canonical, 'skills', skill));
      assert.equal(fs.realpathSync(codexSkill), expectedTarget);
      assert.equal(fs.realpathSync(cursorSkill), expectedTarget);
    }
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('AC-04: unmanaged existing directory at target path is backed up before linking', () => {
  const home = makeTempHome();
  try {
    const agyTarget = path.join(home, '.gemini', 'config', 'plugins', 'faber-spec');
    fs.mkdirSync(agyTarget, { recursive: true });
    fs.writeFileSync(path.join(agyTarget, 'custom-user-file.txt'), 'keep me', 'utf8');

    const res = installEngines({ engines: ['antigravity'], userHome: home });
    const backupPath = res.results[0].backedUpTo;
    assert.ok(backupPath && backupPath.includes('.bak.'), 'expected timestamped backup path');
    assert.equal(fs.readFileSync(path.join(backupPath, 'custom-user-file.txt'), 'utf8'), 'keep me');
    assert.equal(fs.realpathSync(agyTarget), fs.realpathSync(getCanonicalRoot(home)));
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('AC-06: status reports installed state and uninstall cleans up managed links and canonical store', () => {
  const home = makeTempHome();
  try {
    fs.mkdirSync(path.join(home, '.gemini'), { recursive: true });
    fs.mkdirSync(path.join(home, '.cursor'), { recursive: true });

    installEngines({ engines: ['antigravity', 'cursor'], userHome: home });

    const st = getStatus({ userHome: home });
    assert.equal(st.canonicalExists, true);
    assert.equal(st.installedVersion, getPackageVersion());
    const byId = Object.fromEntries(st.engines.map((e) => [e.id, e]));
    assert.equal(byId.antigravity.installed, true);
    assert.equal(byId.cursor.installed, true);
    assert.equal(byId.cursor.installedSkills.length, st.skills.length);
    assert.equal(byId.codex.installed, false);

    const removed = uninstallEngines({ engines: ['cursor'], userHome: home });
    assert.equal(removed.removedCanonical, false, 'canonical store kept while antigravity still installed');
    assert.equal(fs.existsSync(getCanonicalRoot(home)), true);

    const removedLast = uninstallEngines({ engines: ['antigravity'], userHome: home });
    assert.equal(removedLast.removedCanonical, true, 'canonical store removed when last engine uninstalled');
    assert.equal(fs.existsSync(getCanonicalRoot(home)), false);

    const after = getStatus({ userHome: home });
    assert.equal(after.canonicalExists, false);
    assert.equal(after.engines.every((e) => !e.installed), true);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('CLI end-to-end: init --yes, status, uninstall, --version, --help', () => {
  const home = makeTempHome();
  const cli = path.join(PACKAGE_ROOT, 'src', 'cli.mjs');
  const env = { ...process.env, FABER_USER_HOME: home, NO_COLOR: '1' };
  try {
    fs.mkdirSync(path.join(home, '.claude'), { recursive: true });

    const ver = execFileSync(process.execPath, [cli, '--version'], { env, encoding: 'utf8' }).trim();
    assert.equal(ver, getPackageVersion());

    const initOut = execFileSync(process.execPath, [cli, 'init', '--yes'], { env, encoding: 'utf8' });
    assert.match(initOut, /Installed FaberSEP Spec/);
    assert.match(initOut, /Claude Code \/ Desktop/);

    const statusOut = execFileSync(process.execPath, [cli, 'status'], { env, encoding: 'utf8' });
    assert.match(statusOut, /installed/);

    const uninstallOut = execFileSync(process.execPath, [cli, 'uninstall'], { env, encoding: 'utf8' });
    assert.match(uninstallOut, /Removed/);
    assert.equal(fs.existsSync(getCanonicalRoot(home)), false);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('AC-05 & repo invariants: manifests match version, all skills use faber- prefix and fallback paths, no always-on rules', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8'));
  const agy = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, 'plugin.json'), 'utf8'));
  const claude = JSON.parse(
    fs.readFileSync(path.join(PACKAGE_ROOT, '.claude-plugin', 'plugin.json'), 'utf8'),
  );

  assert.equal(agy.version, pkg.version);
  assert.equal(claude.version, pkg.version);
  assert.equal(agy.name, 'faber-spec');
  assert.equal(claude.name, 'faber-spec');

  // Zero idle token tax invariant
  assert.equal(fs.existsSync(path.join(PACKAGE_ROOT, 'rules', 'AGENTS.md')), false);

  const skillDirs = fs
    .readdirSync(path.join(PACKAGE_ROOT, 'skills'), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  assert.ok(skillDirs.length >= 5);
  for (const dir of skillDirs) {
    assert.ok(dir.startsWith('faber-'), `skill dir "${dir}" must start with faber-`);
    const content = fs.readFileSync(path.join(PACKAGE_ROOT, 'skills', dir, 'SKILL.md'), 'utf8');
    assert.match(content, new RegExp(`^---[\\s\\S]*?name:\\s*${dir}\\b`, 'm'));
    assert.ok(
      content.includes('~/.faber/spec/'),
      `skill "${dir}" must include ~/.faber/spec/ fallback path for standalone installs`,
    );
  }
});

const CLI = path.join(PACKAGE_ROOT, 'src', 'cli.mjs');
function runCli(home, args) {
  const env = { ...process.env, FABER_USER_HOME: home, NO_COLOR: '1' };
  try {
    const stdout = execFileSync(process.execPath, [CLI, ...args], { env, encoding: 'utf8', stdio: 'pipe' });
    return { code: 0, out: stdout };
  } catch (err) {
    return { code: err.status, out: `${err.stdout || ''}${err.stderr || ''}` };
  }
}

test('AC-09: init --preview writes nothing and init --apply installs like plain init', () => {
  const home = makeTempHome();
  try {
    fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
    const preview = runCli(home, ['init', '--yes', '--preview']);
    assert.equal(preview.code, 0);
    assert.match(preview.out, /\[dry-run\] Would install/);
    assert.equal(fs.existsSync(getCanonicalRoot(home)), false);
    assert.equal(fs.existsSync(path.join(home, '.claude', 'skills')), false);

    const apply = runCli(home, ['init', '--yes', '--apply']);
    assert.equal(apply.code, 0);
    assert.match(apply.out, /Installed FaberSEP Spec/);
    assert.equal(fs.lstatSync(path.join(home, '.claude', 'skills', 'faber-spec')).isSymbolicLink(), true);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('AC-10: init --engine= with an empty list is rejected and writes nothing', () => {
  const home = makeTempHome();
  try {
    const res = runCli(home, ['init', '--engine=']);
    assert.notEqual(res.code, 0);
    assert.match(res.out, /Supported tools: antigravity, claude-code, codex, cursor/);
    assert.equal(fs.existsSync(getCanonicalRoot(home)), false);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('AC-11: re-running init removes links of skills no longer shipped, keeps other faber-* skills', () => {
  const home = makeTempHome();
  try {
    installEngines({ engines: ['codex'], userHome: home });
    const skillsDir = path.join(home, '.codex', 'skills');
    // A link an older version left for a skill that is no longer shipped.
    fs.symlinkSync(path.join(getCanonicalRoot(home), 'skills', 'faber-retired'), path.join(skillsDir, 'faber-retired'));
    // Another package's faber-* skill (not ours) must stay.
    const other = path.join(home, 'other-pkg', 'faber-other');
    fs.mkdirSync(other, { recursive: true });
    fs.writeFileSync(path.join(other, 'SKILL.md'), '---\nname: faber-other\n---\n');
    fs.symlinkSync(other, path.join(skillsDir, 'faber-other'));

    const res = installEngines({ engines: ['codex'], userHome: home });
    assert.deepEqual(res.results[0].staleRemoved, [path.join(skillsDir, 'faber-retired')]);
    assert.equal(fs.existsSync(path.join(skillsDir, 'faber-retired')), false);
    assert.equal(fs.lstatSync(path.join(skillsDir, 'faber-other')).isSymbolicLink(), true);
    for (const skill of getSkillNames(PACKAGE_ROOT)) {
      assert.equal(fs.existsSync(path.join(skillsDir, skill, 'SKILL.md')), true);
    }
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('AC-12: uninstall leaves a user\'s own link at a faber-* path in place', () => {
  const home = makeTempHome();
  try {
    const mine = path.join(home, 'mine', 'faber-init-arch');
    fs.mkdirSync(mine, { recursive: true });
    fs.writeFileSync(path.join(mine, 'notes.txt'), 'mine');
    const skillsDir = path.join(home, '.codex', 'skills');
    fs.mkdirSync(skillsDir, { recursive: true });
    fs.symlinkSync(mine, path.join(skillsDir, 'faber-init-arch'));

    const res = uninstallEngines({ userHome: home });
    assert.equal(res.removed.length, 0);
    assert.equal(fs.lstatSync(path.join(skillsDir, 'faber-init-arch')).isSymbolicLink(), true);
    assert.equal(fs.readFileSync(path.join(mine, 'notes.txt'), 'utf8'), 'mine');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('AC-13: status reports a folder FaberSEP Spec did not create as not managed', () => {
  const home = makeTempHome();
  try {
    const foreign = path.join(home, '.claude', 'skills', 'faber-spec');
    fs.mkdirSync(foreign, { recursive: true });
    fs.writeFileSync(path.join(foreign, 'notes.txt'), 'x');

    const st = getStatus({ userHome: home });
    const claude = st.engines.find((e) => e.id === 'claude-code');
    assert.equal(claude.installed, false);
    assert.equal(claude.unmanaged, true);
    const out = runCli(home, ['status']).out;
    assert.match(out, /Claude Code \/ Desktop\s+not managed/);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('AC-14: after init --link, status reports the linked checkout', () => {
  const home = makeTempHome();
  try {
    installEngines({ engines: ['claude-code', 'codex'], userHome: home, linkDev: true });
    const st = getStatus({ userHome: home });
    assert.equal(st.canonicalExists, false);
    assert.equal(st.linkedRoot, path.resolve(PACKAGE_ROOT));
    assert.equal(st.linkedVersion, getPackageVersion());
    assert.equal(st.engines.find((e) => e.id === 'claude-code').installed, true);
    assert.equal(st.engines.find((e) => e.id === 'codex').installed, true);
    const out = runCli(home, ['status']).out;
    assert.match(out, /Linked checkout:/);
    assert.doesNotMatch(out, /not installed/);
    uninstallEngines({ userHome: home });
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('AC-15: every rule declares a trigger and the Antigravity manifest has at most 3 suggested prompts', () => {
  const agy = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, 'plugin.json'), 'utf8'));
  assert.ok((agy.suggestedPrompts || []).length <= 3);
  const rulesDir = path.join(PACKAGE_ROOT, 'rules');
  for (const file of fs.readdirSync(rulesDir).filter((f) => f.endsWith('.md'))) {
    const text = fs.readFileSync(path.join(rulesDir, file), 'utf8');
    const front = text.match(/^---\n([\s\S]*?)\n---/);
    assert.ok(front, `${file} needs frontmatter`);
    assert.match(front[1], /^trigger:\s*(always_on|model_decision|glob|manual)\s*$/m, `${file} needs a trigger`);
    // Zero idle tokens: rules load only when a skill reads them.
    assert.doesNotMatch(front[1], /^trigger:\s*always_on/m);
  }
});
