#!/usr/bin/env python3
"""One faber-discuss round: send <ledger>/<tag>-prompt.md to a read-only reviewer CLI (agy or claude),
save the raw reply, and print status, conversation id, token usage, verdict, and phase totals.

Exit codes:
  0  reply read and formatted cleanly
  2  quota, rate limit, or authentication error (stop the run)
  3  timeout
  4  reply missing findings and VERDICT (or CLI error)
  5  reviewer did not resume --conversation and opened a new conversation"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from discuss_log import parse_findings  # noqa: E402

AGY_PERMISSIONS = {"permissions": {"allow": ["read_file(*)"], "deny": ["write_file(*)", "edit_file(*)", "command(*)"]}}
CLAUDE_READONLY_TOOLS = "Read,Glob,Grep"
CLAUDE_DISALLOWED_TOOLS = "Edit,Write,Bash,Agent,WebSearch,WebFetch,NotebookEdit"

DEFAULT_MODELS = {
    "agy": "gemini-4-neon-medium",
    "claude": "opus",
}
# Cheapest models, strictly for testing the skill itself.
CHEAPEST_TEST_MODELS = {
    "agy": ("gemini-3.8-flash-low", "gemini-3.8-flash-medium"),
    "claude": ("haiku",),
}
WARM_MINUTES = 7
USAGE_KEYS = ("input_tokens", "output_tokens", "thinking_tokens", "cache_read_tokens", "total_tokens")
STOP_WORDS = re.compile(
    r"quota|resource.?exhausted|rate.?limit|not logged in|login|unauthenticated|oauth|credit balance",
    re.I,
)


def infer_cli(model: str | None) -> str | None:
    """Infer reviewer CLI from model name when --cli is omitted."""
    if not model:
        return None
    lower = model.lower()
    if lower in ("haiku", "sonnet", "opus", "fable"):
        return "claude"
    if lower.startswith(("gemini-", "gpt-oss-")) or lower.endswith(("-low", "-medium", "-high", "-xhigh")):
        return "agy"
    if lower.startswith("claude-"):
        return "claude"
    return None


def default_cli() -> str:
    """Pick an installed reviewer CLI if --cli is omitted and model does not disambiguate."""
    if shutil.which("agy"):
        return "agy"
    if shutil.which("claude"):
        return "claude"
    return "agy"


def resolve_cli_and_model(cli: str | None, model: str | None, effort: str | None, test: bool) -> tuple[str, str]:
    resolved_cli = cli or infer_cli(model) or default_cli()
    if test:
        allowed = CHEAPEST_TEST_MODELS[resolved_cli]
        resolved_model = model or allowed[0]
        if resolved_model not in allowed:
            raise ValueError(
                f"with --test on '{resolved_cli}', model must be one of the cheapest test models: {', '.join(allowed)}"
            )
    else:
        resolved_model = model or DEFAULT_MODELS[resolved_cli]
    if resolved_cli == "claude" and effort not in ("", "low", "medium", "high", "xhigh", "max"):
        raise ValueError(f"invalid --effort for claude: {effort}")
    return resolved_cli, resolved_model


def build_command(
    cli: str,
    model: str,
    prompt: str,
    timeout: int,
    add_dirs: list[str],
    conversation: str,
    effort: str,
) -> tuple[list[str], str | None]:
    """Return (argv, stdin_text) for the chosen read-only reviewer CLI."""
    if cli == "agy":
        cmd = [
            "agy",
            "-p",
            prompt,
            "--model",
            model,
            "--disable-slash-commands",
            "--print-timeout",
            f"{timeout}s",
            "--output-format",
            "json",
            "--settings",
            json.dumps(AGY_PERMISSIONS),
        ]
        for folder in add_dirs:
            cmd += ["--add-dir", folder]
        if conversation:
            cmd += ["--conversation", conversation]
        return cmd, None

    if cli == "claude":
        cmd = [
            "claude",
            "-p",
            "--model",
            model,
            "--disable-slash-commands",
            "--permission-mode",
            "plan",
            "--tools",
            CLAUDE_READONLY_TOOLS,
            "--disallowedTools",
            CLAUDE_DISALLOWED_TOOLS,
            "--strict-mcp-config",
            "--output-format",
            "json",
        ]
        if effort:
            cmd += ["--effort", effort]
        for folder in add_dirs:
            cmd += ["--add-dir", folder]
        if conversation:
            cmd += ["--resume", conversation]
        return cmd, prompt

    raise ValueError(f"unsupported reviewer CLI: {cli}")


def normalize_reply(cli: str, raw: dict, stderr: str) -> dict:
    """Normalize agy and claude JSON payloads into a common ledger schema."""
    if cli == "agy":
        reply = dict(raw)
        reply["cli"] = "agy"
        if stderr.strip():
            reply["stderr"] = stderr[-4000:]
        return reply

    # Claude -p --output-format json normalization
    raw_usage = raw.get("usage") or {}
    cache_write = int(raw_usage.get("cache_creation_input_tokens") or 0)
    cache_read = int(raw_usage.get("cache_read_input_tokens") or 0)
    inp = int(raw_usage.get("input_tokens") or 0) + cache_write
    out = int(raw_usage.get("output_tokens") or 0)
    is_error = bool(raw.get("is_error"))
    has_payload = bool(raw.get("session_id") or raw.get("result") is not None)
    status = "ERROR" if (is_error or not has_payload) else "SUCCESS"
    reply = {
        "cli": "claude",
        "status": status,
        "conversation_id": raw.get("session_id", ""),
        "response": raw.get("result", "") if isinstance(raw.get("result"), str) else "",
        "num_turns": raw.get("num_turns"),
        "usage": {
            "input_tokens": inp,
            "output_tokens": out,
            "thinking_tokens": 0,
            "cache_read_tokens": cache_read,
            "total_tokens": inp + out,
        },
        "total_cost_usd": raw.get("total_cost_usd"),
        "usage_cumulative": False,
        "raw_provider": raw,
    }
    if is_error and raw.get("result"):
        reply["error"] = str(raw.get("result"))[:1000]
    if stderr.strip():
        reply["stderr"] = stderr[-4000:]
    return reply


def _parse_stdout(stdout: str, stderr: str) -> dict:
    try:
        return json.loads(stdout)
    except json.JSONDecodeError:
        return {"status": "ERROR", "is_error": True, "response": "", "raw": stdout[-4000:], "stderr": stderr[-4000:]}


def _round_order(path: Path) -> tuple[int, int]:
    phase, rnd = path.name.split("-")[:2]
    return int(phase[1:]), int(rnd[1:])


def round_usage(ledger: Path) -> list[tuple[str, dict[str, int]]]:
    """Per-round token usage, handling agy's cumulative conversation totals vs per-turn claude totals."""
    out: list[tuple[str, dict[str, int]]] = []
    last: dict[str, dict[str, int]] = {}
    for path in sorted(ledger.glob("p*-r*-reply.json"), key=_round_order):
        reply = json.loads(path.read_text())
        usage = {k: int(reply.get("usage", {}).get(k, 0) or 0) for k in USAGE_KEYS}
        is_cumulative = reply.get("usage_cumulative", reply.get("cli", "agy") == "agy")
        conv = reply.get("conversation_id", "")
        if is_cumulative:
            prev = last.get(conv) if conv else None
            if prev and all(usage[k] >= prev[k] for k in USAGE_KEYS):
                delta = {k: usage[k] - prev[k] for k in USAGE_KEYS}
            else:
                delta = usage
            if conv:
                last[conv] = usage
        else:
            delta = usage
        out.append((path.name.split("-reply")[0], delta))
    return out


def _totals(ledger: Path) -> dict[str, int]:
    totals: dict[str, int] = {}
    for name, usage in round_usage(ledger):
        phase = name.split("-")[0]
        totals[phase] = totals.get(phase, 0) + usage["total_tokens"]
    return totals


def _minutes_since_last(ledger: Path, conversation: str, now: float) -> float | None:
    times = [
        json.loads(p.read_text()).get("finished_at")
        for p in ledger.glob("p*-r*-reply.json")
        if json.loads(p.read_text()).get("conversation_id") == conversation
    ]
    times = [t for t in times if isinstance(t, (int, float))]
    return (now - max(times)) / 60 if times else None


def _log_round(
    ledger: Path,
    tag: str,
    cli: str,
    model: str,
    test: bool,
    conversation_requested: str,
    add_dir: list[str],
    timeout: int,
    started: float,
    reply: dict,
    code: int,
    prompt_chars: int,
) -> None:
    text = reply.get("response", "")
    usage = dict(round_usage(ledger)).get(tag, {}) if reply else {}
    verdict = re.findall(r"VERDICT:\s*(CONTINUE|DONE)", text)
    row = {
        "tag": tag,
        "cli": cli,
        "model": model,
        "test": test,
        "conversation_requested": conversation_requested,
        "conversation_id": reply.get("conversation_id", ""),
        "started_at": started,
        "finished_at": reply.get("finished_at", time.time()),
        "gap_minutes": reply.get("gap_minutes"),
        "status": reply.get("status", "TIMEOUT" if code == 3 else ""),
        "exit_code": code,
        "num_turns": reply.get("num_turns"),
        "usage": usage,
        "usage_reported": reply.get("usage", {}),
        "prompt_chars": prompt_chars,
        "reply_chars": len(text),
        "verdict": verdict[-1] if verdict else "",
        "findings": parse_findings(text),
        "owner_questions": sorted(set(re.findall(r"\bOQ-\d+\b", text))),
        "add_dir": add_dir,
        "timeout": timeout,
    }
    with (ledger / "rounds.jsonl").open("a") as handle:
        handle.write(json.dumps(row, ensure_ascii=False) + "\n")


def _report(ledger: Path, reply: dict, text: str, stderr: str) -> int:
    rounds = round_usage(ledger)
    usage = rounds[-1][1] if rounds else {}
    print(f"cli: {reply.get('cli', 'agy')}  status: {reply.get('status')}  conversation_id: {reply.get('conversation_id', '')}")
    print(
        f"tokens this round: uncached {usage.get('total_tokens', 0)}, input {usage.get('input_tokens', 0)}, "
        f"cache read {usage.get('cache_read_tokens', 0)}, turns {reply.get('num_turns', 0)}"
    )
    if reply.get("gap_minutes") is not None:
        cold = " (cache likely cold: history may be re-read)" if reply["gap_minutes"] > WARM_MINUTES else ""
        print(f"gap since the last round: {reply['gap_minutes']} min{cold}")
    history = int(reply.get("usage", {}).get("input_tokens", 0) or 0)
    print(f"next round: send within {WARM_MINUTES} min to keep the prompt cache; cold input is about {history}")
    print("totals so far: " + ", ".join(f"{phase} {total}" for phase, total in _totals(ledger).items()))
    if reply.get("status") != "SUCCESS":
        found = stderr + reply.get("raw", "") + str(reply.get("error", "")) + text
        print(f"ERROR: {(reply.get('error') or reply.get('raw') or stderr or text)[:600]}")
        if "DEADLINE_EXCEEDED" in found or "print timeout" in found:
            return 3
        return 2 if STOP_WORDS.search(found) else 4
    verdict = re.findall(r"VERDICT:\s*(CONTINUE|DONE)", text)
    findings = re.findall(r"\bF-\d+\b", text)
    print(f"verdict: {verdict[-1] if verdict else 'none'}  finding ids: {len(set(findings))}")
    return 0 if verdict or findings else 4


def _parse() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("ledger")
    parser.add_argument("tag", help="p1-r1, p2-r3, ...")
    parser.add_argument("--cli", choices=("agy", "claude"), default=None)
    parser.add_argument("--model", default=None)
    parser.add_argument("--effort", default="", help="reasoning effort for claude CLI (low, medium, high)")
    parser.add_argument("--conversation", default="")
    parser.add_argument("--add-dir", action="append", default=[])
    parser.add_argument("--timeout", type=int, default=540)
    parser.add_argument("--test", action="store_true", help="enforce cheapest model for testing the skill itself")
    return parser.parse_args()


def main() -> int:
    args = _parse()
    try:
        cli, model = resolve_cli_and_model(args.cli, args.model, args.effort, args.test)
    except ValueError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2

    ledger = Path(args.ledger)
    prompt = (ledger / f"{args.tag}-prompt.md").read_text()
    command, stdin_text = build_command(
        cli=cli,
        model=model,
        prompt=prompt,
        timeout=args.timeout,
        add_dirs=args.add_dir,
        conversation=args.conversation,
        effort=args.effort,
    )
    started = time.time()
    try:
        done = subprocess.run(
            command,
            input=stdin_text,
            capture_output=True,
            text=True,
            timeout=args.timeout + 30,
            check=False,
        )
    except subprocess.TimeoutExpired:
        print("TIMEOUT: no answer within the limit")
        _log_round(ledger, args.tag, cli, model, args.test, args.conversation, args.add_dir, args.timeout, started, {}, 3, len(prompt))
        return 3

    raw = _parse_stdout(done.stdout, done.stderr)
    reply = normalize_reply(cli, raw, done.stderr)
    reply["finished_at"] = time.time()
    if args.conversation:
        gap = _minutes_since_last(ledger, args.conversation, started)
        if gap is not None:
            reply["gap_minutes"] = round(gap, 1)

    (ledger / f"{args.tag}-reply.json").write_text(json.dumps(reply, indent=2, ensure_ascii=False))
    text = reply.get("response", "")
    (ledger / f"{args.tag}-reply.md").write_text(text)

    code = _report(ledger, reply, text, done.stderr)
    if code == 0 and args.conversation and reply.get("conversation_id") != args.conversation:
        print(f"NEW CONVERSATION: asked to resume {args.conversation}, reviewer answered in {reply.get('conversation_id')}")
        code = 5
    _log_round(ledger, args.tag, cli, model, args.test, args.conversation, args.add_dir, args.timeout, started, reply, code, len(prompt))
    return code


if __name__ == "__main__":
    sys.exit(main())
