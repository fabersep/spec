import * as readline from 'node:readline';

const ESC = '\x1b';
const CYAN = `${ESC}[36m`;
const GREEN = `${ESC}[32m`;
const DIM = `${ESC}[2m`;
const BOLD = `${ESC}[1m`;
const RESET = `${ESC}[0m`;

function useColor() {
  return Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
}

function fmt(code, text) {
  return useColor() ? `${code}${text}${RESET}` : text;
}

/**
 * Zero-dependency interactive checkbox prompt for Node.js TTYs.
 * items: Array<{ id: string, label: string, hint?: string, checked: boolean }>
 * Returns selected ids or null if cancelled.
 */
export function promptMultiSelect({ title, subtitle, items }) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    const stdout = process.stdout;
    const state = items.map((item) => ({ ...item }));
    let cursor = 0;
    let renderedLines = 0;

    function render() {
      if (renderedLines > 0) {
        stdout.write(`${ESC}[${renderedLines}A${ESC}[0J`);
      }
      const lines = [];
      lines.push(fmt(BOLD, title));
      if (subtitle) {
        lines.push(fmt(DIM, subtitle));
      }
      lines.push('');
      for (let i = 0; i < state.length; i++) {
        const item = state[i];
        const isCurrent = i === cursor;
        const pointer = isCurrent ? fmt(CYAN, '>') : ' ';
        const box = item.checked ? fmt(GREEN, '[x]') : fmt(DIM, '[ ]');
        const label = isCurrent ? fmt(BOLD, item.label.padEnd(23)) : item.label.padEnd(23);
        const hint = item.hint ? fmt(DIM, item.hint) : '';
        lines.push(`  ${pointer} ${box} ${label} ${hint}`.trimEnd());
      }
      lines.push('');
      const selectedCount = state.filter((s) => s.checked).length;
      lines.push(
        fmt(
          DIM,
          `  ${selectedCount} selected  •  ↑/↓ move  •  Space toggle  •  a toggle all  •  Enter install  •  q cancel`,
        ),
      );
      stdout.write(lines.join('\n') + '\n');
      renderedLines = lines.length;
    }

    function cleanup() {
      stdin.removeListener('keypress', onKeypress);
      if (stdin.isTTY) {
        stdin.setRawMode(false);
      }
      stdin.pause();
    }

    function onKeypress(str, key) {
      if (!key) return;
      if ((key.ctrl && key.name === 'c') || key.name === 'escape' || str === 'q') {
        cleanup();
        stdout.write('\n');
        resolve(null);
        return;
      }
      if (key.name === 'up' || str === 'k') {
        cursor = (cursor - 1 + state.length) % state.length;
        render();
        return;
      }
      if (key.name === 'down' || str === 'j') {
        cursor = (cursor + 1) % state.length;
        render();
        return;
      }
      if (key.name === 'space' || str === ' ') {
        state[cursor].checked = !state[cursor].checked;
        render();
        return;
      }
      if (str === 'a') {
        const allChecked = state.every((s) => s.checked);
        for (const item of state) item.checked = !allChecked;
        render();
        return;
      }
      if (key.name === 'return' || key.name === 'enter') {
        cleanup();
        stdout.write('\n');
        resolve(state.filter((s) => s.checked).map((s) => s.id));
      }
    }

    readline.emitKeypressEvents(stdin);
    if (stdin.isTTY) {
      stdin.setRawMode(true);
    }
    stdin.resume();
    stdin.on('keypress', onKeypress);
    render();
  });
}
