#!/usr/bin/env node
import {
  detectEngines,
  getPackageVersion,
  getStatus,
  installEngines,
  uninstallEngines,
} from './installer.mjs';
import { promptMultiSelect } from './prompt.mjs';

const ESC = '\x1b';
const useColor = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
const bold = (s) => (useColor ? `${ESC}[1m${s}${ESC}[0m` : s);
const green = (s) => (useColor ? `${ESC}[32m${s}${ESC}[0m` : s);
const yellow = (s) => (useColor ? `${ESC}[33m${s}${ESC}[0m` : s);
const dim = (s) => (useColor ? `${ESC}[2m${s}${ESC}[0m` : s);
const red = (s) => (useColor ? `${ESC}[31m${s}${ESC}[0m` : s);

function printHelp() {
  const version = getPackageVersion();
  console.log(`${bold(`FaberSEP Spec v${version}`)} — Spec-driven templates & faber-* skills for AI coding agents

${bold('Usage:')}
  npx @fabersep/spec init [options]       Detect installed AI tools and install faber-* skills
  npx @fabersep/spec status               Show installed version, skills, and connected tools
  npx @fabersep/spec uninstall [options]  Remove FaberSEP Spec links/files from AI tools

${bold('Init options:')}
  -y, --yes                  Skip interactive prompt and install into all detected tools
  --engine <list>            Comma-separated tools: antigravity,claude-code,codex,cursor
  --dry-run                  Preview what would be installed without modifying disk
  --link                     Link directly to this local checkout (for contributors)
  --undo                     Alias for uninstall

${bold('Examples:')}
  npx @fabersep/spec init
  npx @fabersep/spec init --yes
  npx @fabersep/spec init --engine antigravity,claude-code
  npx @fabersep/spec status
  npx @fabersep/spec uninstall
`);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  let command = null;
  const flags = {
    yes: false,
    dryRun: false,
    link: false,
    undo: false,
    help: false,
    version: false,
    engines: null,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-h' || arg === '--help') {
      flags.help = true;
    } else if (arg === '-v' || arg === '--version') {
      flags.version = true;
    } else if (arg === '-y' || arg === '--yes') {
      flags.yes = true;
    } else if (arg === '--dry-run') {
      flags.dryRun = true;
    } else if (arg === '--link') {
      flags.link = true;
    } else if (arg === '--undo') {
      flags.undo = true;
    } else if (arg === '--engine' || arg === '--engines') {
      const val = args[++i];
      if (!val) throw new Error(`${arg} requires a comma-separated list of engines`);
      flags.engines = val
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (arg.startsWith('--engine=')) {
      flags.engines = arg
        .slice('--engine='.length)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (!arg.startsWith('-') && !command) {
      command = arg;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return { command, flags };
}

async function runInit(flags) {
  if (flags.undo) {
    return runUninstall(flags);
  }

  const version = getPackageVersion();
  const detectedList = detectEngines();
  let selectedIds = flags.engines;

  if (!selectedIds) {
    if (flags.yes || !process.stdin.isTTY) {
      selectedIds = detectedList.filter((e) => e.detected).map((e) => e.id);
      if (selectedIds.length === 0) {
        console.log(
          yellow(
            'No supported AI coding tools were auto-detected (~/.gemini, ~/.claude, ~/.codex, ~/.cursor).',
          ),
        );
        console.log(
          'Specify targets explicitly, e.g.: npx @fabersep/spec init --engine claude-code,antigravity',
        );
        return 1;
      }
    } else {
      console.log('');
      selectedIds = await promptMultiSelect({
        title: `FaberSEP Spec v${version} — Select AI coding tools to install into:`,
        subtitle: 'Detected tools are pre-selected. Toggle any tool with Space, then press Enter.',
        items: detectedList.map((e) => ({
          id: e.id,
          label: e.label,
          hint: e.detected ? `(detected: ${e.detectHint})` : `(not found: ${e.detectHint})`,
          checked: e.detected,
        })),
      });

      if (selectedIds === null) {
        console.log(dim('Cancelled. Nothing was modified.'));
        return 0;
      }
      if (selectedIds.length === 0) {
        console.log(yellow('No tools selected. Nothing was installed.'));
        return 0;
      }
    }
  }

  const summary = installEngines({
    engines: selectedIds,
    linkDev: flags.link,
    dryRun: flags.dryRun,
  });

  if (flags.dryRun) {
    console.log(bold(`[dry-run] Would install FaberSEP Spec v${summary.version}`));
    console.log(`  Canonical store: ${summary.canonicalRoot}`);
    console.log(`  Skills (${summary.skills.length}): ${summary.skills.join(', ')}`);
    for (const r of summary.results) {
      console.log(`  • ${r.label}: ${r.targets.join(', ')}`);
    }
    return 0;
  }

  console.log(green(`✓ Installed FaberSEP Spec v${summary.version}`));
  console.log(dim(`  Source: ${summary.canonicalRoot}`));
  console.log(dim(`  Skills (${summary.skills.length}): ${summary.skills.join(', ')}`));
  console.log('');
  for (const r of summary.results) {
    const targetSummary =
      r.mode === 'plugin' ? r.targets[0] : `${r.targets.length} skills -> ${r.targets[0].replace(/\/faber-[^/]+$/, '')}`;
    console.log(`  ${green('✓')} ${bold(r.label.padEnd(22))} ${targetSummary} ${dim(`(${r.method})`)}`);
    if (r.backedUpTo) {
      console.log(yellow(`    backed up previous directory to: ${r.backedUpTo}`));
    }
  }
  console.log('');
  console.log(bold('Next step:'));
  console.log('  Open any project in your AI coding tool and ask:');
  console.log(dim('  "Run faber-init-arch to document this repository\'s architecture."'));
  console.log('');
  return 0;
}

function runStatus() {
  const st = getStatus();
  console.log(bold(`FaberSEP Spec Status`));
  console.log(
    `  Canonical store: ${st.canonicalRoot} ${
      st.canonicalExists ? green(`(v${st.installedVersion || '?'})`) : yellow('(not installed)')
    }`,
  );
  console.log(`  Skills (${st.skills.length}): ${st.skills.join(', ')}`);
  console.log('');
  for (const e of st.engines) {
    const state = e.installed
      ? green('installed')
      : e.detected
        ? yellow('detected (not linked)')
        : dim('not detected');
    const detail = e.installed
      ? e.mode === 'plugin'
        ? e.targetHint
        : `${e.installedSkills.length}/${st.skills.length} skills in ${e.targetHint}`
      : e.detectHint;
    console.log(`  ${e.label.padEnd(23)} ${state.padEnd(28)} ${dim(detail)}`);
  }
  return 0;
}

function runUninstall(flags) {
  const res = uninstallEngines({
    engines: flags.engines || undefined,
    dryRun: flags.dryRun,
  });

  if (res.removed.length === 0 && !res.removedCanonical) {
    console.log(dim('Nothing to uninstall — FaberSEP Spec was not installed.'));
    return 0;
  }

  const prefix = flags.dryRun ? '[dry-run] Would remove' : 'Removed';
  for (const item of res.removed) {
    console.log(`  ${green('✓')} ${prefix} (${item.label}): ${item.path}`);
  }
  if (res.removedCanonical) {
    console.log(`  ${green('✓')} ${prefix} canonical store: ${res.canonicalRoot}`);
  }
  console.log(dim('\nProject docs/ folders in your repositories were not touched.'));
  return 0;
}

async function main() {
  try {
    const { command, flags } = parseArgs(process.argv);
    if (flags.version) {
      console.log(getPackageVersion());
      return 0;
    }
    if (flags.help || !command) {
      printHelp();
      return 0;
    }
    if (command === 'init') {
      return await runInit(flags);
    }
    if (command === 'status') {
      return runStatus();
    }
    if (command === 'uninstall' || command === 'remove') {
      return runUninstall(flags);
    }
    console.error(red(`Unknown command: ${command}`));
    printHelp();
    return 1;
  } catch (err) {
    console.error(red(`Error: ${err.message}`));
    return 1;
  }
}

process.exitCode = await main();
