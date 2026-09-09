import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from urllib.error import URLError


MODULE_PATH = Path(__file__).with_name("marketplace-mirror-server.py")
SPEC = importlib.util.spec_from_file_location("marketplace_mirror_server", MODULE_PATH)
MIRROR = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MIRROR)


class MarketplaceMirrorServerTest(unittest.TestCase):
    def test_cache_key_ignores_query_parameter_order(self):
        first = "/api/v1/skills/items?sort=relevance&page=2&pageSize=20"
        second = "/api/v1/skills/items?pageSize=20&page=2&sort=relevance"

        self.assertEqual(MIRROR.canonical_path_query(first), MIRROR.canonical_path_query(second))
        self.assertEqual(MIRROR.cache_key(first), MIRROR.cache_key(second))

    def test_fresh_cache_is_served_without_source_request(self):
        cached = {
            "body": b"{}",
            "meta": {"cachedAt": MIRROR.utc_now_iso()},
        }

        with patch.object(MIRROR, "read_cache", return_value=cached), patch.object(
            MIRROR, "fetch_and_cache"
        ) as fetch_and_cache:
            resolved, status = MIRROR.resolve_cached_response("/api/v1/skills/items?page=1")

        self.assertIs(resolved, cached)
        self.assertEqual(status, "hit")
        fetch_and_cache.assert_not_called()

    def test_stale_cache_is_refreshed(self):
        stale = {
            "body": b"old",
            "meta": {"cachedAt": "2020-01-01T00:00:00Z"},
        }
        refreshed = {
            "body": b"new",
            "meta": {"cachedAt": MIRROR.utc_now_iso()},
        }

        with patch.object(MIRROR, "read_cache", return_value=stale), patch.object(
            MIRROR, "fetch_and_cache", return_value=refreshed
        ):
            resolved, status = MIRROR.resolve_cached_response("/api/v1/skills/items?page=1")

        self.assertIs(resolved, refreshed)
        self.assertEqual(status, "stale-refreshed")

    def test_stale_cache_is_used_only_when_refresh_fails(self):
        stale = {
            "body": b"old",
            "meta": {"cachedAt": "2020-01-01T00:00:00Z"},
        }

        with patch.object(MIRROR, "read_cache", return_value=stale), patch.object(
            MIRROR, "fetch_and_cache", side_effect=URLError("offline")
        ):
            resolved, status = MIRROR.resolve_cached_response("/api/v1/skills/items?page=1")

        self.assertIs(resolved, stale)
        self.assertEqual(status, "stale-if-error")

    def test_missing_cache_does_not_hide_source_failure(self):
        with patch.object(MIRROR, "read_cache", return_value=None), patch.object(
            MIRROR, "fetch_and_cache", side_effect=URLError("offline")
        ):
            with self.assertRaises(URLError):
                MIRROR.resolve_cached_response("/api/v1/skills/items?page=1")

    def test_removed_skill_evicts_slug_package_and_file_cache(self):
        previous_manifest = {
            "skills": {
                "slugs": ["bird", "weather"],
                "packageNames": {
                    "bird": "@nextclaw/bird",
                    "weather": "@nextclaw/weather",
                },
            },
        }
        current_package_names = {"weather": "@nextclaw/weather"}
        cached_paths = [
            "/api/v1/skills/items/bird",
            "/api/v1/skills/items/%40nextclaw%2Fbird",
            "/api/v1/skills/items/bird/content",
            "/api/v1/skills/items/bird/files",
            "/api/v1/skills/items/bird/files/blob?path=SKILL.md",
            "/api/v1/skills/items/weather",
        ]

        with tempfile.TemporaryDirectory() as temp_dir:
            responses_dir = Path(temp_dir) / "responses"
            responses_dir.mkdir()
            with patch.object(MIRROR, "RESPONSES_DIR", responses_dir):
                for path in cached_paths:
                    MIRROR.write_cache(path, {
                        "status": 200,
                        "contentType": "application/json",
                        "contentDisposition": None,
                        "skillFileSha256": None,
                        "body": json.dumps({"path": path}).encode("utf-8"),
                    })

                evicted = MIRROR.evict_removed_skill_cache(
                    previous_manifest,
                    ["weather"],
                    current_package_names,
                )

                self.assertEqual(evicted, {"slugs": ["bird"], "cacheEntries": 5})
                for path in cached_paths[:-1]:
                    self.assertIsNone(MIRROR.read_cache(path))
                self.assertIsNotNone(MIRROR.read_cache("/api/v1/skills/items/weather"))

    def test_old_manifest_still_evicts_legacy_official_package_selector(self):
        previous_manifest = {"skills": {"slugs": ["bird"]}}

        with tempfile.TemporaryDirectory() as temp_dir:
            responses_dir = Path(temp_dir) / "responses"
            responses_dir.mkdir()
            with patch.object(MIRROR, "RESPONSES_DIR", responses_dir):
                MIRROR.write_cache("/api/v1/skills/items/%40nextclaw%2Fbird/files", {
                    "status": 200,
                    "contentType": "application/json",
                    "contentDisposition": None,
                    "skillFileSha256": None,
                    "body": b"{}",
                })

                evicted = MIRROR.evict_removed_skill_cache(previous_manifest, [], {})

                self.assertEqual(evicted, {"slugs": ["bird"], "cacheEntries": 1})
                self.assertIsNone(MIRROR.read_cache("/api/v1/skills/items/%40nextclaw%2Fbird/files"))

    def test_sync_refreshes_file_manifest_before_prewarming_blobs(self):
        def cached(body):
            return {
                "body": json.dumps(body).encode("utf-8"),
                "meta": {"sizeBytes": 1},
            }

        def prewarm(path):
            if path == "/api/v1/skills/items?page=1&pageSize=100":
                return cached({
                    "data": {
                        "total": 1,
                        "totalPages": 1,
                        "items": [{
                            "slug": "weather",
                            "packageName": "@nextclaw/weather",
                        }],
                    },
                })
            if path == "/api/v1/skills/items/weather/files":
                return cached({
                    "data": {
                        "files": [{
                            "path": "scripts/new-file.mjs",
                            "downloadPath": "/api/v1/skills/items/weather/files/blob?path=scripts%2Fnew-file.mjs",
                        }],
                    },
                })
            return cached({})

        with tempfile.TemporaryDirectory() as temp_dir, patch.object(
            MIRROR, "MANIFEST_PATH", Path(temp_dir) / "manifest.json"
        ), patch.object(
            MIRROR, "prewarm_path", side_effect=prewarm
        ) as prewarm_path, patch.object(
            MIRROR,
            "evict_removed_skill_cache",
            return_value={"slugs": [], "cacheEntries": 0},
        ):
            manifest = MIRROR.sync_snapshot()

        self.assertEqual(manifest["skills"]["fileCount"], 1)
        self.assertEqual(manifest["schemaVersion"], 3)
        self.assertEqual(
            manifest["skills"]["sourceVersions"],
            {"weather": None},
        )
        prewarm_path.assert_any_call("/api/v1/skills/items/weather/files")
        prewarm_path.assert_any_call(
            "/api/v1/skills/items/weather/files/blob?path=scripts%2Fnew-file.mjs"
        )

    def test_sync_skips_unchanged_skill_content(self):
        updated_at = "2026-09-09T00:00:00.000Z"

        def cached(body):
            return {
                "body": json.dumps(body).encode("utf-8"),
                "meta": {"sizeBytes": 1},
            }

        def prewarm(path):
            if path == "/api/v1/skills/items?page=1&pageSize=100":
                return cached({
                    "data": {
                        "total": 1,
                        "totalPages": 1,
                        "items": [{
                            "slug": "weather",
                            "packageName": "@nextclaw/weather",
                            "updatedAt": updated_at,
                        }],
                    },
                })
            if path in (
                "/health",
                "/api/v1/skills/scenes",
                "/api/v1/skills/recommendations",
            ):
                return cached({})
            raise AssertionError(f"unexpected content refresh: {path}")

        previous_manifest = {
            "schemaVersion": 3,
            "skills": {
                "slugs": ["weather"],
                "packageNames": {"weather": "@nextclaw/weather"},
                "sourceVersions": {"weather": updated_at},
                "fileCounts": {"weather": 2},
                "failed": [],
            },
        }

        with tempfile.TemporaryDirectory() as temp_dir:
            manifest_path = Path(temp_dir) / "manifest.json"
            manifest_path.write_text(json.dumps(previous_manifest), encoding="utf-8")
            with patch.object(MIRROR, "MANIFEST_PATH", manifest_path), patch.object(
                MIRROR, "prewarm_path", side_effect=prewarm
            ) as prewarm_path, patch.object(
                MIRROR,
                "evict_removed_skill_cache",
                return_value={"slugs": [], "cacheEntries": 0},
            ):
                manifest = MIRROR.sync_snapshot()

        self.assertEqual(manifest["skills"]["fileCount"], 2)
        self.assertEqual(prewarm_path.call_count, 4)

    def test_sync_refreshes_changed_and_previously_failed_skills_only(self):
        old_version = "2026-09-08T00:00:00.000Z"
        new_version = "2026-09-09T00:00:00.000Z"

        def cached(body):
            return {
                "body": json.dumps(body).encode("utf-8"),
                "meta": {"sizeBytes": 1},
            }

        def prewarm(path):
            if path == "/api/v1/skills/items?page=1&pageSize=100":
                return cached({
                    "data": {
                        "total": 3,
                        "totalPages": 1,
                        "items": [
                            {"slug": "stable", "updatedAt": old_version},
                            {"slug": "changed", "updatedAt": new_version},
                            {"slug": "retry", "updatedAt": old_version},
                        ],
                    },
                })
            if path.endswith("/files"):
                slug = path.split("/")[-2]
                return cached({
                    "data": {
                        "files": [{
                            "downloadPath": f"/api/v1/skills/items/{slug}/files/blob?path=SKILL.md",
                        }],
                    },
                })
            return cached({})

        previous_manifest = {
            "schemaVersion": 3,
            "skills": {
                "slugs": ["stable", "changed", "retry"],
                "sourceVersions": {
                    "stable": old_version,
                    "changed": old_version,
                    "retry": old_version,
                },
                "fileCounts": {"stable": 2, "changed": 3, "retry": 4},
                "failed": [{"slug": "retry", "error": "temporary"}],
            },
        }

        with tempfile.TemporaryDirectory() as temp_dir:
            manifest_path = Path(temp_dir) / "manifest.json"
            manifest_path.write_text(json.dumps(previous_manifest), encoding="utf-8")
            with patch.object(MIRROR, "MANIFEST_PATH", manifest_path), patch.object(
                MIRROR, "prewarm_path", side_effect=prewarm
            ) as prewarm_path, patch.object(
                MIRROR,
                "evict_removed_skill_cache",
                return_value={"slugs": [], "cacheEntries": 0},
            ):
                manifest = MIRROR.sync_snapshot()

        calls = [call.args[0] for call in prewarm_path.call_args_list]
        self.assertFalse(any("/stable/" in path for path in calls))
        self.assertTrue(any("/changed/" in path for path in calls))
        self.assertTrue(any("/retry/" in path for path in calls))
        self.assertEqual(manifest["skills"]["fileCounts"], {
            "stable": 2,
            "changed": 1,
            "retry": 1,
        })

    def test_sync_failure_preserves_previous_file_count_for_retry(self):
        version = "2026-09-09T00:00:00.000Z"

        def cached(body):
            return {
                "body": json.dumps(body).encode("utf-8"),
                "meta": {"sizeBytes": 1},
            }

        def prewarm(path):
            if path == "/api/v1/skills/items?page=1&pageSize=100":
                return cached({
                    "data": {
                        "total": 1,
                        "totalPages": 1,
                        "items": [{"slug": "weather", "updatedAt": version}],
                    },
                })
            if path == "/api/v1/skills/items/weather/content":
                raise URLError("temporary")
            return cached({})

        previous_manifest = {
            "schemaVersion": 3,
            "skills": {
                "slugs": ["weather"],
                "sourceVersions": {"weather": "2026-09-08T00:00:00.000Z"},
                "fileCounts": {"weather": 2},
                "failed": [],
            },
        }

        with tempfile.TemporaryDirectory() as temp_dir:
            manifest_path = Path(temp_dir) / "manifest.json"
            manifest_path.write_text(json.dumps(previous_manifest), encoding="utf-8")
            with patch.object(MIRROR, "MANIFEST_PATH", manifest_path), patch.object(
                MIRROR, "prewarm_path", side_effect=prewarm
            ), patch.object(
                MIRROR,
                "evict_removed_skill_cache",
                return_value={"slugs": [], "cacheEntries": 0},
            ):
                first = MIRROR.sync_snapshot()
                second = MIRROR.sync_snapshot()

        self.assertEqual(first["skills"]["fileCounts"], {"weather": 2})
        self.assertEqual(first["skills"]["failed"][0]["slug"], "weather")
        self.assertEqual(second["skills"]["failed"][0]["slug"], "weather")


if __name__ == "__main__":
    unittest.main()
