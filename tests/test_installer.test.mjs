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

    const removed = uninstallEngines({ userHome: home });
    assert.equal(removed.removedCanonical, true);
    assert.ok(removed.removed.length >= 1 + st.skills.length);
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
