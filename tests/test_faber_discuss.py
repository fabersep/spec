import json
import sys
import unittest
from pathlib import Path
from unittest import mock

SKILL_DIR = Path(__file__).resolve().parents[1] / "skills" / "faber-discuss"
sys.path.insert(0, str(SKILL_DIR))

import discuss_log  # noqa: E402
import discuss_round  # noqa: E402


class TestDiscussRound(unittest.TestCase):
    def test_resolve_cli_and_cheapest_test_models(self) -> None:
        self.assertEqual(discuss_round.resolve_cli_and_model("agy", None, "", test=True), ("agy", "gemini-3.8-flash-low"))
        self.assertEqual(discuss_round.resolve_cli_and_model("claude", None, "", test=True), ("claude", "haiku"))
        with self.assertRaises(ValueError):
            discuss_round.resolve_cli_and_model("agy", "gemini-4-neon-medium", "", test=True)
        with self.assertRaises(ValueError):
            discuss_round.resolve_cli_and_model("claude", "opus", "", test=True)

    def test_infer_cli_distinguishes_backends(self) -> None:
        self.assertEqual(discuss_round.infer_cli("gemini-4-neon-medium"), "agy")
        self.assertEqual(discuss_round.infer_cli("claude-opus-5-5-medium"), "agy")
        self.assertEqual(discuss_round.infer_cli("opus"), "claude")
        self.assertEqual(discuss_round.infer_cli("haiku"), "claude")
        self.assertEqual(discuss_round.infer_cli("claude-sonnet-4-6"), "claude")

    def test_build_command_readonly_flags(self) -> None:
        agy_cmd, agy_stdin = discuss_round.build_command(
            cli="agy",
            model="gemini-3.8-flash-low",
            prompt="hello",
            timeout=120,
            add_dirs=["/tmp/other"],
            conversation="conv-1",
            effort="",
        )
        self.assertIsNone(agy_stdin)
        self.assertIn("--conversation", agy_cmd)
        self.assertIn("conv-1", agy_cmd)
        self.assertIn("--add-dir", agy_cmd)
        self.assertIn("write_file(*)", agy_cmd[agy_cmd.index("--settings") + 1])

        claude_cmd, claude_stdin = discuss_round.build_command(
            cli="claude",
            model="haiku",
            prompt="hello",
            timeout=120,
            add_dirs=["/tmp/other"],
            conversation="sess-1",
            effort="low",
        )
        self.assertEqual(claude_stdin, "hello")
        self.assertIn("--resume", claude_cmd)
        self.assertIn("sess-1", claude_cmd)
        self.assertIn("Read,Glob,Grep", claude_cmd)
        self.assertIn("--disallowedTools", claude_cmd)
        self.assertIn("plan", claude_cmd)

    def test_round_usage_handles_agy_cumulative_vs_claude_per_turn(self) -> None:
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            ledger = Path(tmp)
            (ledger / "p1-r1-reply.json").write_text(
                json.dumps(
                    {
                        "cli": "agy",
                        "conversation_id": "c1",
                        "usage": {"input_tokens": 100, "output_tokens": 20, "cache_read_tokens": 50, "total_tokens": 120},
                    }
                )
            )
            (ledger / "p1-r2-reply.json").write_text(
                json.dumps(
                    {
                        "cli": "agy",
                        "conversation_id": "c1",
                        "usage": {"input_tokens": 140, "output_tokens": 35, "cache_read_tokens": 200, "total_tokens": 175},
                    }
                )
            )
            (ledger / "p2-r1-reply.json").write_text(
                json.dumps(
                    {
                        "cli": "claude",
                        "conversation_id": "s1",
                        "usage_cumulative": False,
                        "usage": {"input_tokens": 80, "output_tokens": 15, "cache_read_tokens": 10, "total_tokens": 95},
                    }
                )
            )
            usage = dict(discuss_round.round_usage(ledger))
            self.assertEqual(usage["p1-r1"]["total_tokens"], 120)
            self.assertEqual(usage["p1-r2"]["total_tokens"], 55)
            self.assertEqual(usage["p1-r2"]["cache_read_tokens"], 150)
            self.assertEqual(usage["p2-r1"]["total_tokens"], 95)


class TestDiscussLog(unittest.TestCase):
    def test_parse_findings_and_stats(self) -> None:
        import tempfile

        text = "F-1 [BLOCKER] [OPEN]: Missing guard.\nF-2 [MINOR] [CLOSED]: Typo.\nOQ-1: Decide price.\nVERDICT: CONTINUE\n"
        parsed = discuss_log.parse_findings(text)
        self.assertEqual(len(parsed), 2)
        self.assertEqual(parsed[0], {"id": "F-1", "severity": "BLOCKER", "status": "OPEN"})

        with tempfile.TemporaryDirectory() as tmp:
            ledger = Path(tmp)
            discuss_log.cmd_init(
                mock.Mock(
                    ledger=str(ledger),
                    topic="demo",
                    scenario="demo",
                    author_model="gemini-4-neon-medium",
                    author_effort="medium",
                    reviewer_cli="claude",
                    reviewer_model="haiku",
                    budget=100000,
                    rounds=3,
                    phase="both",
                    repo=[],
                    author_context=None,
                    plan_5h=None,
                )
            )
            (ledger / "p1-r1-prompt.md").write_text("Brief")
            (ledger / "p1-r1-reply.md").write_text(text)
            (ledger / "rounds.jsonl").write_text(
                json.dumps(
                    {
                        "tag": "p1-r1",
                        "cli": "claude",
                        "model": "haiku",
                        "gap_minutes": None,
                        "usage": {"input_tokens": 50, "cache_read_tokens": 0, "output_tokens": 25, "total_tokens": 75},
                        "findings": parsed,
                        "verdict": "CONTINUE",
                    }
                )
                + "\n"
            )
            discuss_log.cmd_rule(
                mock.Mock(ledger=str(ledger), round="p1-r1", id="F-1", by="author", ruling="ACCEPT", reason="valid", note="ok")
            )
            discuss_log.cmd_end(
                mock.Mock(ledger=str(ledger), reason="done", author_tokens=None, author_context=None, plan_5h=None)
            )
            report = discuss_log.stats(ledger)
            self.assertIn("reviewer claude/haiku", report)
            self.assertIn("Findings: 2 (BLOCKER 1, MINOR 1)", report)
            self.assertIn("Findings with no ruling: F-2", report)
            self.assertIn("Owner questions raised: 1", report)


if __name__ == "__main__":
    unittest.main()
