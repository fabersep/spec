import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const PACKAGE_ROOT = path.resolve(__dirname, '..');
export const META_FILENAME = '.faber-spec-meta.json';

export function getPackageVersion() {
  const pkgPath = path.join(PACKAGE_ROOT, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  return pkg.version;
}

export function getUserHome() {
  return process.env.FABER_USER_HOME || os.homedir();
}

export function getCanonicalRoot(userHome = getUserHome()) {
  return path.join(userHome, '.faber', 'spec');
}

export function getSkillNames(sourceRoot = PACKAGE_ROOT) {
  const skillsDir = path.join(sourceRoot, 'skills');
  if (!fs.existsSync(skillsDir)) return [];
  return fs
    .readdirSync(skillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('faber-'))
    .map((entry) => entry.name)
    .sort();
}

export function getEngineDefs(userHome = getUserHome()) {
  return [
    {
      id: 'antigravity',
      label: 'Antigravity',
      detectPath: path.join(userHome, '.gemini'),
      detectHint: '~/.gemini',
      mode: 'plugin',
      targetPath: path.join(userHome, '.gemini', 'config', 'plugins', 'faber-spec'),
      targetHint: '~/.gemini/config/plugins/faber-spec',
    },
    {
      id: 'claude-code',
      label: 'Claude Code / Desktop',
      detectPath: path.join(userHome, '.claude'),
      detectHint: '~/.claude',
      mode: 'plugin',
      targetPath: path.join(userHome, '.claude', 'skills', 'faber-spec'),
      targetHint: '~/.claude/skills/faber-spec',
    },
    {
      id: 'codex',
      label: 'OpenAI Codex',
      detectPath: path.join(userHome, '.codex'),
      detectHint: '~/.codex',
      mode: 'skills',
      targetPath: path.join(userHome, '.codex', 'skills'),
      targetHint: '~/.codex/skills/faber-*',
    },
    {
      id: 'cursor',
      label: 'Cursor',
      detectPath: path.join(userHome, '.cursor'),
      detectHint: '~/.cursor',
      mode: 'skills',
      targetPath: path.join(userHome, '.cursor', 'skills'),
      targetHint: '~/.cursor/skills/faber-*',
    },
  ];
}

export function detectEngines(userHome = getUserHome()) {
  return getEngineDefs(userHome).map((engine) => ({
    ...engine,
    detected: fs.existsSync(engine.detectPath),
  }));
}

function shouldCopyEntry(srcPath) {
  const base = path.basename(srcPath);
  if (base === '__pycache__' || base === '.DS_Store' || base.endsWith('.pyc')) {
    return false;
  }
  return true;
}

function copyTree(src, dst) {
  if (!shouldCopyEntry(src)) return;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dst, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyTree(path.join(src, entry), path.join(dst, entry));
    }
  } else {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
    fs.chmodSync(dst, stat.mode);
  }
}

export function stageCanonicalInstall({
  userHome = getUserHome(),
  sourceRoot = PACKAGE_ROOT,
  dryRun = false,
} = {}) {
  const canonicalRoot = getCanonicalRoot(userHome);
  const version = getPackageVersion();
  const itemsToStage = [
    'plugin.json',
    '.claude-plugin',
    'rules',
    'templates',
    'skills',
    'LICENSE',
    'README.md',
  ];

  if (dryRun) {
    return { canonicalRoot, version, staged: false };
  }

  fs.rmSync(canonicalRoot, { recursive: true, force: true });
  fs.mkdirSync(canonicalRoot, { recursive: true });

  for (const rel of itemsToStage) {
    const src = path.join(sourceRoot, rel);
    if (fs.existsSync(src)) {
      copyTree(src, path.join(canonicalRoot, rel));
    }
  }

  const meta = {
    name: '@fabersep/spec',
    version,
    installedAt: new Date().toISOString(),
    skills: getSkillNames(canonicalRoot),
  };
  fs.writeFileSync(
    path.join(canonicalRoot, META_FILENAME),
    JSON.stringify(meta, null, 2) + '\n',
    'utf8',
  );

  return { canonicalRoot, version, staged: true, skills: meta.skills };
}

function isSymlink(p) {
  try {
    return fs.lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
}

function isManagedTarget(p) {
  if (isSymlink(p)) return true;
  if (!fs.existsSync(p)) return false;
  if (fs.existsSync(path.join(p, META_FILENAME))) return true;
  const pluginJson = path.join(p, 'plugin.json');
  if (fs.existsSync(pluginJson)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(pluginJson, 'utf8'));
      if (parsed.name === 'faber-spec') return true;
    } catch {
      return false;
    }
  }
  const skillMd = path.join(p, 'SKILL.md');
  if (fs.existsSync(skillMd) && path.basename(p).startsWith('faber-')) {
    return true;
  }
  return false;
}

function linkOrCopyDir(src, dst, { dryRun = false } = {}) {
  let backedUpTo = null;
  if (isSymlink(dst) || fs.existsSync(dst)) {
    if (isManagedTarget(dst)) {
      if (!dryRun) {
        fs.rmSync(dst, { recursive: true, force: true });
      }
    } else {
      backedUpTo = `${dst}.bak.${Date.now()}`;
      if (!dryRun) {
        fs.renameSync(dst, backedUpTo);
      }
    }
  }

  if (dryRun) {
    return { method: 'symlink', backedUpTo };
  }

  fs.mkdirSync(path.dirname(dst), { recursive: true });
  try {
    const type = process.platform === 'win32' ? 'junction' : 'dir';
    fs.symlinkSync(src, dst, type);
    return { method: 'symlink', backedUpTo };
  } catch (err) {
    if (err && (err.code === 'EPERM' || err.code === 'EACCES' || err.code === 'EXDEV')) {
      copyTree(src, dst);
      return { method: 'copy', backedUpTo };
    }
    throw err;
  }
}

export function installEngines({
  engines,
  userHome = getUserHome(),
  sourceRoot = PACKAGE_ROOT,
  linkDev = false,
  dryRun = false,
} = {}) {
  const allDefs = new Map(getEngineDefs(userHome).map((e) => [e.id, e]));
  const selectedIds = engines && engines.length > 0 ? engines : [];
  for (const id of selectedIds) {
    if (!allDefs.has(id)) {
      throw new Error(`Unknown engine "${id}". Supported: ${[...allDefs.keys()].join(', ')}`);
    }
  }

  const effectiveRoot = linkDev
    ? path.resolve(sourceRoot)
    : stageCanonicalInstall({ userHome, sourceRoot, dryRun }).canonicalRoot;

  const skills = getSkillNames(linkDev ? effectiveRoot : sourceRoot);
  const results = [];

  for (const id of selectedIds) {
    const def = allDefs.get(id);
    if (def.mode === 'plugin') {
      const outcome = linkOrCopyDir(effectiveRoot, def.targetPath, { dryRun });
      results.push({
        engine: id,
        label: def.label,
        mode: 'plugin',
        targets: [def.targetPath],
        method: outcome.method,
        backedUpTo: outcome.backedUpTo,
      });
    } else {
      const targets = [];
      let method = 'symlink';
      const backups = [];
      for (const skill of skills) {
        const srcSkill = path.join(effectiveRoot, 'skills', skill);
        const dstSkill = path.join(def.targetPath, skill);
        const outcome = linkOrCopyDir(srcSkill, dstSkill, { dryRun });
        targets.push(dstSkill);
        method = outcome.method;
        if (outcome.backedUpTo) backups.push(outcome.backedUpTo);
      }
      results.push({
        engine: id,
        label: def.label,
        mode: 'skills',
        targets,
        method,
        backedUpTo: backups.length > 0 ? backups : null,
      });
    }
  }

  return {
    version: getPackageVersion(),
    canonicalRoot: effectiveRoot,
    skills,
    dryRun,
    results,
  };
}

export function getStatus({ userHome = getUserHome() } = {}) {
  const canonicalRoot = getCanonicalRoot(userHome);
  const metaPath = path.join(canonicalRoot, META_FILENAME);
  let meta = null;
  if (fs.existsSync(metaPath)) {
    try {
      meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    } catch {
      meta = null;
    }
  }

  const expectedSkills = meta?.skills || getSkillNames(PACKAGE_ROOT);
  const engines = detectEngines(userHome).map((engine) => {
    if (engine.mode === 'plugin') {
      const exists = isSymlink(engine.targetPath) || fs.existsSync(engine.targetPath);
      const linkTarget = isSymlink(engine.targetPath) ? fs.readlinkSync(engine.targetPath) : null;
      return {
        ...engine,
        installed: exists,
        linkTarget,
        installedSkills: exists ? expectedSkills : [],
      };
    }
    const installedSkills = expectedSkills.filter((skill) => {
      const p = path.join(engine.targetPath, skill);
      return isSymlink(p) || fs.existsSync(p);
    });
    return {
      ...engine,
      installed: installedSkills.length > 0,
      linkTarget: null,
      installedSkills,
    };
  });

  return {
    canonicalRoot,
    canonicalExists: fs.existsSync(canonicalRoot),
    installedVersion: meta?.version || null,
    packageVersion: getPackageVersion(),
    skills: expectedSkills,
    engines,
  };
}

export function uninstallEngines({
  engines,
  userHome = getUserHome(),
  removeCanonical = true,
  dryRun = false,
} = {}) {
  const allDefs = getEngineDefs(userHome);
  const targetIds = engines && engines.length > 0 ? new Set(engines) : new Set(allDefs.map((e) => e.id));
  const canonicalRoot = getCanonicalRoot(userHome);
  const skillNames = new Set([
    ...getSkillNames(PACKAGE_ROOT),
    ...(fs.existsSync(canonicalRoot) ? getSkillNames(canonicalRoot) : []),
  ]);

  const removed = [];

  for (const def of allDefs) {
    if (!targetIds.has(def.id)) continue;
    if (def.mode === 'plugin') {
      if ((isSymlink(def.targetPath) || fs.existsSync(def.targetPath)) && isManagedTarget(def.targetPath)) {
        if (!dryRun) {
          fs.rmSync(def.targetPath, { recursive: true, force: true });
        }
        removed.push({ engine: def.id, label: def.label, path: def.targetPath });
      }
    } else {
      for (const skill of skillNames) {
        const p = path.join(def.targetPath, skill);
        if ((isSymlink(p) || fs.existsSync(p)) && isManagedTarget(p)) {
          if (!dryRun) {
            fs.rmSync(p, { recursive: true, force: true });
          }
          removed.push({ engine: def.id, label: def.label, path: p });
        }
      }
    }
  }

  let removedCanonical = false;
  if (removeCanonical && (!engines || engines.length === 0) && fs.existsSync(canonicalRoot)) {
    if (!dryRun) {
      fs.rmSync(canonicalRoot, { recursive: true, force: true });
    }
    removedCanonical = true;
  }

  return { removed, removedCanonical, canonicalRoot, dryRun };
}
