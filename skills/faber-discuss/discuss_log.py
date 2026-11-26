#!/usr/bin/env python3
"""Run records for faber-discuss so runs across different author/reviewer pairs can be compared.

  discuss_log.py init <ledger> --topic T --scenario S --author-model M --author-effort E
                       --reviewer-cli CLI --reviewer-model R [--budget N] [--rounds N]
                       [--phase both|discuss|spec] [--repo PATH ...]
  discuss_log.py rule <ledger> <round-tag> F-n --ruling ACCEPT|REJECT|PARTIAL|OWNER|SETTLED
                       [--reason wrong-claim|out-of-scope|already-covered|owner-decides|valid] [--note TEXT]
  discuss_log.py end <ledger> --reason done|cap|budget|error|stalemate [--author-tokens N]
                       [--author-context N] [--plan-5h PCT]
  discuss_log.py outcome <ledger> F-n --was right|wrong [--note TEXT]
  discuss_log.py stats <ledger>

Files in the ledger: run.json, rounds.jsonl, rulings.jsonl, outcomes.jsonl, stats.md, transcript.md,
and per-round p<phase>-r<n>-prompt.md / -reply.json / -reply.md."""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import time
from collections import Counter
from pathlib import Path

RULINGS = ("ACCEPT", "REJECT", "PARTIAL", "OWNER", "SETTLED")
REASONS = ("valid", "wrong-claim", "out-of-scope", "already-covered", "owner-decides")
FINDING = re.compile(r"\b(F-\d+)\b\W{0,6}\[?(BLOCKER|MAJOR|MINOR)\]?\W{0,6}\[?(OPEN|CLOSED)?\]?")
OWNER_Q = re.compile(r"\bOQ-\d+\b")


def parse_findings(text: str) -> list[dict]:
    """Findings as the reviewer wrote them: first mention of each ID with its severity and status."""
    seen: dict[str, dict] = {}
    for match in FINDING.finditer(text):
        fid, severity, status = match.groups()
        if fid not in seen:
            seen[fid] = {"id": fid, "severity": severity, "status": status or ""}
    return list(seen.values())


def _round_key(tag: str) -> tuple[int, int]:
    phase, rnd = tag.split("-")[:2]
    return int(phase[1:]), int(rnd[1:])


def _jsonl(path: Path) -> list[dict]:
    if not path.exists():
        return []
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


def _append(path: Path, row: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a") as handle:
        handle.write(json.dumps(row, ensure_ascii=False) + "\n")


def _commit(path: str) -> str:
    done = subprocess.run(["git", "-C", path, "rev-parse", "HEAD"], capture_output=True, text=True, check=False)
    return done.stdout.strip()


def cmd_init(args: argparse.Namespace) -> int:
    ledger = Path(args.ledger)
    ledger.mkdir(parents=True, exist_ok=True)
    run = {
        "topic": args.topic,
        "scenario": args.scenario,
        "started_at": time.time(),
        "author": {"model": args.author_model, "effort": args.author_effort},
        "reviewer": {"cli": args.reviewer_cli, "model": args.reviewer_model},
        "budget": args.budget,
        "rounds_per_phase": args.rounds,
        "phase": args.phase,
        "repos": {repo: _commit(repo) for repo in args.repo},
    }
    if args.author_context is not None:
        run["author"]["context_start"] = args.author_context
    if args.plan_5h is not None:
        run["author"]["plan_5h_start"] = args.plan_5h
    (ledger / "run.json").write_text(json.dumps(run, indent=2, ensure_ascii=False))
    print(f"run.json written: {ledger / 'run.json'}")
    return 0


def cmd_rule(args: argparse.Namespace) -> int:
    ledger = Path(args.ledger)
    row = {
        "at": time.time(),
        "round": args.round,
        "id": args.id,
        "by": args.by,
        "ruling": args.ruling,
        "reason": args.reason or ("owner-decides" if args.ruling == "OWNER" else ""),
        "note": args.note,
    }
    _append(ledger / "rulings.jsonl", row)
    print(f"{args.id}: {args.ruling} {row['reason']}")
    return 0


def cmd_end(args: argparse.Namespace) -> int:
    path = Path(args.ledger) / "run.json"
    run = json.loads(path.read_text()) if path.exists() else {}
    run["ended_at"] = time.time()
    run["end_reason"] = args.reason
    author = run.setdefault("author", {})
    if args.author_tokens is not None:
        author["tokens"] = args.author_tokens
    if args.author_context is not None:
        author["context_end"] = args.author_context
    if args.plan_5h is not None:
        author["plan_5h_end"] = args.plan_5h
    path.write_text(json.dumps(run, indent=2, ensure_ascii=False))
    print(f"run ended: {args.reason}")
    return 0


def cmd_outcome(args: argparse.Namespace) -> int:
    _append(
        Path(args.ledger) / "outcomes.jsonl",
        {"at": time.time(), "id": args.id, "was": args.was, "note": args.note},
    )
    print(f"{args.id}: was {args.was}")
    return 0


def stats(ledger: Path) -> str:
    run = json.loads((ledger / "run.json").read_text()) if (ledger / "run.json").exists() else {}
    rounds = sorted(_jsonl(ledger / "rounds.jsonl"), key=lambda r: _round_key(r["tag"]))
    rulings = _jsonl(ledger / "rulings.jsonl")
    lines = [f"# Stats: {run.get('topic', ledger.name)}", ""]
    author, reviewer = run.get("author", {}), run.get("reviewer", {})
    reviewer_label = reviewer.get("model", "?")
    if reviewer.get("cli"):
        reviewer_label = f"{reviewer['cli']}/{reviewer_label}"
    lines.append(
        f"- Pair: author {author.get('model', '?')} ({author.get('effort', '?')}), "
        f"reviewer {reviewer_label}; scenario {run.get('scenario', '?')}"
    )
    if run.get("started_at") and run.get("ended_at"):
        lines.append(
            f"- Wall time: {round((run['ended_at'] - run['started_at']) / 60, 1)} min; "
            f"ended: {run.get('end_reason', '?')}"
        )
    if "tokens" in author:
        lines.append(f"- Author tokens: {author['tokens']}")
    if "context_start" in author and "context_end" in author:
        lines.append(
            f"- Author context: {author['context_start']} -> {author['context_end']} "
            f"(+{author['context_end'] - author['context_start']})"
        )
    if "plan_5h_start" in author and "plan_5h_end" in author:
        lines.append(f"- Plan 5-hour use: {author['plan_5h_start']}% -> {author['plan_5h_end']}%")
    lines += [
        "",
        "| Round | CLI | Model | Gap min | Input | Cache read | Output | Uncached | New findings | Verdict |",
        "| :--- | :--- | :--- | ---: | ---: | ---: | ---: | ---: | ---: | :--- |",
    ]
    totals: Counter = Counter()
    raised: dict[str, dict] = {}
    for row in rounds:
        usage = row.get("usage", {})
        new = [f for f in row.get("findings", []) if f["id"] not in raised]
        for finding in new:
            raised[finding["id"]] = {**finding, "round": row["tag"]}
        for key in ("input_tokens", "cache_read_tokens", "output_tokens", "total_tokens"):
            totals[key] += usage.get(key, 0)
        gap_str = row.get("gap_minutes") if row.get("gap_minutes") is not None else "-"
        lines.append(
            f"| {row['tag']} | {row.get('cli', '')} | {row.get('model', '')} | {gap_str} | "
            f"{usage.get('input_tokens', 0)} | {usage.get('cache_read_tokens', 0)} | "
            f"{usage.get('output_tokens', 0)} | {usage.get('total_tokens', 0)} | {len(new)} | "
            f"{row.get('verdict', '')} |"
        )
    seen_input = totals["input_tokens"] + totals["cache_read_tokens"]
    ratio = f"{round(100 * totals['cache_read_tokens'] / seen_input)}%" if seen_input else "-"
    lines.append(
        f"| **Total** | | | | {totals['input_tokens']} | {totals['cache_read_tokens']} | "
        f"{totals['output_tokens']} | {totals['total_tokens']} | {len(raised)} | cache {ratio} |"
    )
    last: dict[str, dict] = {}
    for row in rulings:
        if last.get(row["id"], {}).get("by") == "owner" and row.get("by", "author") != "owner":
            continue
        last[row["id"]] = row
    by_owner = sum(1 for r in last.values() if r.get("by") == "owner")
    outcomes = {row["id"]: row["was"] for row in _jsonl(ledger / "outcomes.jsonl")}
    severity = Counter(f["severity"] for f in raised.values())
    ruling = Counter(r["ruling"] for r in last.values())
    reason = Counter(r["reason"] for r in last.values() if r["reason"])
    unruled = sorted(set(raised) - set(last), key=lambda i: int(i[2:]))
    owner_qs: set[str] = set()
    for path in ledger.glob("p*-r*-reply.md"):
        owner_qs |= set(OWNER_Q.findall(path.read_text()))
    lines += [
        "",
        f"- Findings: {len(raised)} ({', '.join(f'{k} {v}' for k, v in sorted(severity.items())) or 'none'})",
        f"- Rulings (last per finding): {', '.join(f'{k} {v}' for k, v in sorted(ruling.items())) or 'none'}",
        f"- Reasons: {', '.join(f'{k} {v}' for k, v in sorted(reason.items())) or 'none'}",
        f"- Rulings set by the owner: {by_owner}",
        f"- Later outcomes: right {sum(1 for v in outcomes.values() if v == 'right')}, "
        f"wrong {sum(1 for v in outcomes.values() if v == 'wrong')}",
        f"- Owner questions raised: {len(owner_qs)}",
        f"- Findings with no ruling: {', '.join(unruled) or 'none'}",
    ]
    return "\n".join(lines) + "\n"


def transcript(ledger: Path) -> str:
    tags = sorted({p.name.split("-prompt")[0] for p in ledger.glob("p*-r*-prompt.md")}, key=_round_key)
    parts = []
    for tag in tags:
        parts.append(f"# {tag}: author -> reviewer\n\n" + (ledger / f"{tag}-prompt.md").read_text())
        reply = ledger / f"{tag}-reply.md"
        if reply.exists():
            parts.append(f"# {tag}: reviewer -> author\n\n" + reply.read_text())
    return "\n\n---\n\n".join(parts) + "\n"


def cmd_stats(args: argparse.Namespace) -> int:
    ledger = Path(args.ledger)
    text = stats(ledger)
    (ledger / "stats.md").write_text(text)
    (ledger / "transcript.md").write_text(transcript(ledger))
    print(text)
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)
    init = sub.add_parser("init")
    init.add_argument("ledger")
    init.add_argument("--topic", required=True)
    init.add_argument("--scenario", default="")
    init.add_argument("--author-model", required=True)
    init.add_argument("--author-effort", default="")
    init.add_argument("--reviewer-cli", default="")
    init.add_argument("--reviewer-model", required=True)
    init.add_argument("--budget", type=int, default=500_000)
    init.add_argument("--rounds", type=int, default=5)
    init.add_argument("--phase", default="both", choices=("both", "discuss", "spec"))
    init.add_argument("--repo", action="append", default=[])
    init.add_argument("--author-context", type=int, help="the author session's context tokens at the start")
    init.add_argument("--plan-5h", type=int, help="the plan's 5-hour use in percent at the start")
    init.set_defaults(func=cmd_init)

    rule = sub.add_parser("rule")
    rule.add_argument("ledger")
    rule.add_argument("round")
    rule.add_argument("id")
    rule.add_argument("--ruling", required=True, choices=RULINGS)
    rule.add_argument("--reason", choices=REASONS)
    rule.add_argument("--note", default="")
    rule.add_argument("--by", default="author", choices=("author", "owner"))
    rule.set_defaults(func=cmd_rule)

    end = sub.add_parser("end")
    end.add_argument("ledger")
    end.add_argument("--reason", required=True, choices=("done", "cap", "budget", "error", "stalemate"))
    end.add_argument("--author-tokens", type=int, help="the author's tokens when known (a subagent's total)")
    end.add_argument("--author-context", type=int, help="the author session's context tokens at the end")
    end.add_argument("--plan-5h", type=int)
    end.set_defaults(func=cmd_end)

    out = sub.add_parser("outcome")
    out.add_argument("ledger")
    out.add_argument("id")
    out.add_argument("--was", required=True, choices=("right", "wrong"))
    out.add_argument("--note", default="")
    out.set_defaults(func=cmd_outcome)

    stat = sub.add_parser("stats")
    stat.add_argument("ledger")
    stat.set_defaults(func=cmd_stats)

    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
