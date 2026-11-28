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

function isInside(child, parent) {
  const rel = path.relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function hasOwnerMarker(dir) {
  if (!fs.existsSync(dir)) return false;
  if (fs.existsSync(path.join(dir, META_FILENAME))) return true;
  const pluginJson = path.join(dir, 'plugin.json');
  if (fs.existsSync(pluginJson)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(pluginJson, 'utf8'));
      if (parsed.name === 'faber-spec') return true;
    } catch {
      return false;
    }
  }
  const skillMd = path.join(dir, 'SKILL.md');
  if (fs.existsSync(skillMd) && path.basename(dir).startsWith('faber-')) {
    return true;
  }
  return false;
}

// A path is ours only when it (or, for a link, the folder it points to) carries the
// FaberSEP Spec marker, the faber-spec plugin manifest, or a faber-* skill. A user's
// own folder or link is never treated as ours.
function isManagedTarget(p, { canonicalRoot } = {}) {
  if (isSymlink(p)) {
    const target = path.resolve(path.dirname(p), fs.readlinkSync(p));
    if (canonicalRoot && isInside(target, canonicalRoot)) return true;
    let real;
    try {
      real = fs.realpathSync(p);
    } catch {
      return false; // dangling link outside our store: not ours
    }
    return hasOwnerMarker(real);
  }
  return hasOwnerMarker(p);
}

function linkTargetOf(p) {
  return isSymlink(p) ? path.resolve(path.dirname(p), fs.readlinkSync(p)) : null;
}

function linkOrCopyDir(src, dst, { dryRun = false, canonicalRoot } = {}) {
  let backedUpTo = null;
  if (isSymlink(dst) || fs.existsSync(dst)) {
    if (isManagedTarget(dst, { canonicalRoot })) {
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
      if (!fs.existsSync(path.join(dst, META_FILENAME))) {
        fs.writeFileSync(
          path.join(dst, META_FILENAME),
          JSON.stringify({ name: '@fabersep/spec', version: getPackageVersion() }, null, 2) + '\n',
          'utf8',
        );
      }
      return { method: 'copy', backedUpTo };
    }
    throw err;
  }
}

// Remove faber-* entries in a per-skill tool folder that an earlier FaberSEP Spec
// install created but the current version no longer ships. Only links into our own
// store (or linked checkout) and copies carrying our marker are touched, so skills
// from other packages that share the faber- prefix stay in place.
function removeStaleSkills(dir, currentSkills, { roots, dryRun }) {
  if (!fs.existsSync(dir)) return [];
  const keep = new Set(currentSkills);
  const removed = [];
  for (const name of fs.readdirSync(dir)) {
    if (!name.startsWith('faber-') || keep.has(name)) continue;
    const p = path.join(dir, name);
    const target = linkTargetOf(p);
    const ours = target
      ? roots.some((root) => isInside(target, path.join(root, 'skills')))
      : fs.existsSync(path.join(p, META_FILENAME));
    if (!ours) continue;
    if (!dryRun) fs.rmSync(p, { recursive: true, force: true });
    removed.push(p);
  }
  return removed;
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
  const canonicalRoot = getCanonicalRoot(userHome);
  const results = [];

  for (const id of selectedIds) {
    const def = allDefs.get(id);
    if (def.mode === 'plugin') {
      const outcome = linkOrCopyDir(effectiveRoot, def.targetPath, { dryRun, canonicalRoot });
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
        const outcome = linkOrCopyDir(srcSkill, dstSkill, { dryRun, canonicalRoot });
        targets.push(dstSkill);
        method = outcome.method;
        if (outcome.backedUpTo) backups.push(outcome.backedUpTo);
      }
      const staleRemoved = removeStaleSkills(def.targetPath, skills, {
        roots: [canonicalRoot, effectiveRoot],
        dryRun,
      });
      results.push({
        engine: id,
        label: def.label,
        mode: 'skills',
        targets,
        method,
        backedUpTo: backups.length > 0 ? backups : null,
        staleRemoved,
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
  const owned = (p) => (isSymlink(p) || fs.existsSync(p)) && isManagedTarget(p, { canonicalRoot });
  const present = (p) => isSymlink(p) || fs.existsSync(p);
  const linkedRoots = new Set();
  const engines = detectEngines(userHome).map((engine) => {
    if (engine.mode === 'plugin') {
      const installed = owned(engine.targetPath);
      const linkTarget = linkTargetOf(engine.targetPath);
      if (installed && linkTarget && !isInside(linkTarget, canonicalRoot)) linkedRoots.add(linkTarget);
      return {
        ...engine,
        installed,
        unmanaged: !installed && present(engine.targetPath),
        linkTarget,
        installedSkills: installed ? expectedSkills : [],
      };
    }
    const installedSkills = [];
    const unmanagedSkills = [];
    for (const skill of expectedSkills) {
      const p = path.join(engine.targetPath, skill);
      if (owned(p)) {
        installedSkills.push(skill);
        const t = linkTargetOf(p);
        if (t && !isInside(t, canonicalRoot)) linkedRoots.add(path.dirname(path.dirname(t)));
      } else if (present(p)) {
        unmanagedSkills.push(skill);
      }
    }
    return {
      ...engine,
      installed: installedSkills.length > 0,
      unmanaged: installedSkills.length === 0 && unmanagedSkills.length > 0,
      unmanagedSkills,
      linkTarget: null,
      installedSkills,
    };
  });

  const linkedRoot = linkedRoots.size > 0 ? [...linkedRoots][0] : null;
  let linkedVersion = null;
  if (linkedRoot) {
    try {
      linkedVersion = JSON.parse(fs.readFileSync(path.join(linkedRoot, 'package.json'), 'utf8')).version;
    } catch {
      linkedVersion = null;
    }
  }

  return {
    canonicalRoot,
    canonicalExists: fs.existsSync(canonicalRoot),
    installedVersion: meta?.version || null,
    linkedRoot,
    linkedVersion,
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
      if ((isSymlink(def.targetPath) || fs.existsSync(def.targetPath)) && isManagedTarget(def.targetPath, { canonicalRoot })) {
        if (!dryRun) {
          fs.rmSync(def.targetPath, { recursive: true, force: true });
        }
        removed.push({ engine: def.id, label: def.label, path: def.targetPath });
      }
    } else {
      for (const skill of skillNames) {
        const p = path.join(def.targetPath, skill);
        if ((isSymlink(p) || fs.existsSync(p)) && isManagedTarget(p, { canonicalRoot })) {
          if (!dryRun) {
            fs.rmSync(p, { recursive: true, force: true });
          }
          removed.push({ engine: def.id, label: def.label, path: p });
        }
      }
    }
  }

  let removedCanonical = false;
  const remainingInstalled =
    engines && engines.length > 0
      ? allDefs.some((def) => {
          if (targetIds.has(def.id)) return false;
          const ours = (p) => (isSymlink(p) || fs.existsSync(p)) && isManagedTarget(p, { canonicalRoot });
          if (def.mode === 'plugin') return ours(def.targetPath);
          return [...skillNames].some((skill) => ours(path.join(def.targetPath, skill)));
        })
      : false;

  if (removeCanonical && !remainingInstalled && fs.existsSync(canonicalRoot)) {
    if (!dryRun) {
      fs.rmSync(canonicalRoot, { recursive: true, force: true });
    }
    removedCanonical = true;
  }

  return { removed, removedCanonical, canonicalRoot, dryRun };
}
