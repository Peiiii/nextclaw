import hashlib
import importlib.util
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


MODULE_PATH = Path(__file__).with_name("validate-marketplace-skill.py")
SPEC = importlib.util.spec_from_file_location("validate_marketplace_skill", MODULE_PATH)
VALIDATOR = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(VALIDATOR)


class MarketplaceSkillPublicationValidationTest(unittest.TestCase):
    def test_collect_local_file_hashes_matches_publisher_file_scope(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            skill_dir = Path(temp_dir)
            (skill_dir / "scripts").mkdir()
            (skill_dir / "SKILL.md").write_text("skill", encoding="utf-8")
            (skill_dir / "scripts" / "helper.mjs").write_bytes(b"helper")
            (skill_dir / ".nextclaw-install.json").write_text("{}", encoding="utf-8")

            files = VALIDATOR.collect_local_file_hashes(skill_dir)

        self.assertEqual(files, {
            "SKILL.md": hashlib.sha256(b"skill").hexdigest(),
            "scripts/helper.mjs": hashlib.sha256(b"helper").hexdigest(),
        })

    def test_exact_remote_manifest_matches_local_publication(self):
        local_files = {
            "SKILL.md": "skill-hash",
            "scripts/helper.mjs": "helper-hash",
        }
        payload = {
            "ok": True,
            "data": {
                "totalFiles": 2,
                "files": [
                    {"path": "SKILL.md", "sha256": "skill-hash"},
                    {"path": "scripts/helper.mjs", "sha256": "helper-hash"},
                ],
            },
        }

        errors = VALIDATOR.compare_remote_file_manifest(
            local_files,
            payload,
            "https://marketplace.example",
        )

        self.assertEqual(errors, [])

    def test_remote_manifest_reports_missing_unexpected_and_changed_files(self):
        local_files = {
            "SKILL.md": "current-skill-hash",
            "scripts/helper.mjs": "helper-hash",
        }
        payload = {
            "ok": True,
            "data": {
                "totalFiles": 2,
                "files": [
                    {"path": "SKILL.md", "sha256": "stale-skill-hash"},
                    {"path": "scripts/removed.mjs", "sha256": "removed-hash"},
                ],
            },
        }

        errors = VALIDATOR.compare_remote_file_manifest(
            local_files,
            payload,
            "https://mirror.example",
        )

        self.assertTrue(any("missing remote files: scripts/helper.mjs" in error for error in errors))
        self.assertTrue(any("unexpected remote files: scripts/removed.mjs" in error for error in errors))
        self.assertTrue(any("sha256 mismatch: SKILL.md" in error for error in errors))

    def test_remote_parity_wait_retries_until_mirror_matches(self):
        stale_payload = {
            "ok": True,
            "data": {"totalFiles": 0, "files": []},
        }
        current_payload = {
            "ok": True,
            "data": {
                "totalFiles": 1,
                "files": [{
                    "path": "SKILL.md",
                    "sha256": hashlib.sha256(b"skill").hexdigest(),
                }],
            },
        }
        with tempfile.TemporaryDirectory() as temp_dir:
            skill_dir = Path(temp_dir)
            (skill_dir / "SKILL.md").write_text("skill", encoding="utf-8")
            with patch.object(
                VALIDATOR,
                "fetch_json",
                side_effect=[stale_payload, current_payload],
            ) as fetch_json, patch.object(
                VALIDATOR.time,
                "monotonic",
                side_effect=[0, 1],
            ), patch.object(VALIDATOR.time, "sleep") as sleep:
                errors = VALIDATOR.wait_for_remote_file_parity(
                    skill_dir,
                    "example",
                    "https://mirror.example",
                    wait_seconds=10,
                    poll_seconds=2,
                )

        self.assertEqual(errors, [])
        self.assertEqual(fetch_json.call_count, 2)
        sleep.assert_called_once_with(2)


if __name__ == "__main__":
    unittest.main()
