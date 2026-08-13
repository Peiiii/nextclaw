#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import sys
import time
from pathlib import Path
from typing import Any
from urllib.parse import quote
from urllib.request import Request, urlopen


REQUIRED_TOP_LEVEL_FIELDS = (
    "slug",
    "name",
    "summary",
    "description",
    "author",
    "tags",
)

REQUIRED_LOCALES = ("en", "zh")
LOCAL_INSTALL_STATE_FILE = ".nextclaw-install.json"


def read_json(path: Path) -> dict[str, Any]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise ValueError(f"missing file: {path}") from exc
    except json.JSONDecodeError as exc:
        raise ValueError(f"invalid json: {path} ({exc})") from exc
    if not isinstance(data, dict):
        raise ValueError(f"json root must be object: {path}")
    return data


def require_non_empty_string(data: dict[str, Any], field: str, errors: list[str]) -> str | None:
    value = data.get(field)
    if not isinstance(value, str) or not value.strip():
        errors.append(f"{field} must be a non-empty string")
        return None
    return value.strip()


def require_string_map(
    data: dict[str, Any], field: str, required_locales: tuple[str, ...], errors: list[str]
) -> dict[str, str] | None:
    value = data.get(field)
    if not isinstance(value, dict):
        errors.append(f"{field} must be an object")
        return None

    normalized: dict[str, str] = {}
    for key, item in value.items():
        if not isinstance(key, str):
            errors.append(f"{field} contains non-string locale key")
            continue
        if not isinstance(item, str) or not item.strip():
            errors.append(f"{field}.{key} must be a non-empty string")
            continue
        normalized[key.strip().lower()] = item.strip()

    for locale in required_locales:
        if locale not in normalized:
            errors.append(f"{field}.{locale} is required")
    return normalized


def require_tags(data: dict[str, Any], errors: list[str]) -> list[str] | None:
    value = data.get("tags")
    if not isinstance(value, list) or len(value) == 0:
        errors.append("tags must be a non-empty array")
        return None

    tags: list[str] = []
    for index, item in enumerate(value):
        if not isinstance(item, str) or not item.strip():
            errors.append(f"tags[{index}] must be a non-empty string")
            continue
        tags.append(item.strip())
    return tags


def collect_local_file_hashes(skill_dir: Path) -> dict[str, str]:
    files: dict[str, str] = {}
    for path in sorted(skill_dir.rglob("*")):
        if path.is_symlink() or not path.is_file():
            continue
        relative_path = path.relative_to(skill_dir).as_posix()
        if relative_path == LOCAL_INSTALL_STATE_FILE:
            continue
        files[relative_path] = hashlib.sha256(path.read_bytes()).hexdigest()
    return files


def compare_remote_file_manifest(
    local_files: dict[str, str],
    payload: dict[str, Any],
    api_base: str,
) -> list[str]:
    errors: list[str] = []
    data = payload.get("data") if payload.get("ok") is True else None
    if not isinstance(data, dict):
        return [f"{api_base}: files response must contain ok=true and object data"]

    remote_entries = data.get("files")
    if not isinstance(remote_entries, list):
        return [f"{api_base}: data.files must be an array"]

    remote_files: dict[str, str] = {}
    for index, entry in enumerate(remote_entries):
        if not isinstance(entry, dict):
            errors.append(f"{api_base}: files[{index}] must be an object")
            continue
        path = entry.get("path")
        sha256 = entry.get("sha256")
        if not isinstance(path, str) or not path:
            errors.append(f"{api_base}: files[{index}].path must be a non-empty string")
            continue
        if path in remote_files:
            errors.append(f"{api_base}: duplicate remote file: {path}")
            continue
        if not isinstance(sha256, str) or not sha256:
            errors.append(f"{api_base}: files[{index}].sha256 must be a non-empty string")
            continue
        remote_files[path] = sha256

    total_files = data.get("totalFiles")
    if total_files != len(remote_entries):
        errors.append(
            f"{api_base}: totalFiles={total_files!r} does not match files length={len(remote_entries)}"
        )

    missing = sorted(set(local_files) - set(remote_files))
    unexpected = sorted(set(remote_files) - set(local_files))
    if missing:
        errors.append(f"{api_base}: missing remote files: {', '.join(missing)}")
    if unexpected:
        errors.append(f"{api_base}: unexpected remote files: {', '.join(unexpected)}")

    for path in sorted(set(local_files) & set(remote_files)):
        if local_files[path] != remote_files[path]:
            errors.append(
                f"{api_base}: sha256 mismatch: {path} "
                f"(local={local_files[path]}, remote={remote_files[path]})"
            )
    return errors


def fetch_json(url: str) -> dict[str, Any]:
    request = Request(
        url,
        headers={
            "accept": "application/json",
            "user-agent": "nextclaw-marketplace-skill-validator/1.0",
        },
    )
    with urlopen(request, timeout=30) as response:
        payload = json.loads(response.read().decode("utf-8"))
    if not isinstance(payload, dict):
        raise ValueError(f"json root must be object: {url}")
    return payload


def wait_for_remote_file_parity(
    skill_dir: Path,
    slug: str,
    api_base: str,
    wait_seconds: float,
    poll_seconds: float,
) -> list[str]:
    local_files = collect_local_file_hashes(skill_dir)
    files_url = f"{api_base.rstrip('/')}/api/v1/skills/items/{quote(slug, safe='')}/files"
    deadline = time.monotonic() + max(wait_seconds, 0)
    last_errors: list[str] = []
    while True:
        try:
            last_errors = compare_remote_file_manifest(local_files, fetch_json(files_url), api_base)
        except (OSError, TimeoutError, ValueError, json.JSONDecodeError) as error:
            last_errors = [f"{api_base}: publication verification request failed: {error}"]
        if not last_errors or time.monotonic() >= deadline:
            return last_errors
        time.sleep(max(poll_seconds, 0.1))


def validate_skill_dir(skill_dir: Path) -> int:
    errors: list[str] = []
    warnings: list[str] = []

    if not skill_dir.exists():
        errors.append(f"skill dir does not exist: {skill_dir}")
        return report(skill_dir, errors, warnings)

    skill_md = skill_dir / "SKILL.md"
    metadata_path = skill_dir / "marketplace.json"

    if not skill_md.is_file():
        errors.append(f"missing SKILL.md: {skill_md}")

    metadata = read_json(metadata_path) if metadata_path.exists() else None
    if metadata is None:
        errors.append(f"missing marketplace.json: {metadata_path}")
        return report(skill_dir, errors, warnings)

    for field in REQUIRED_TOP_LEVEL_FIELDS:
        if field == "tags":
            continue
        require_non_empty_string(metadata, field, errors)

    slug = require_non_empty_string(metadata, "slug", errors)
    summary = require_non_empty_string(metadata, "summary", errors)
    description = require_non_empty_string(metadata, "description", errors)
    summary_i18n = require_string_map(metadata, "summaryI18n", REQUIRED_LOCALES, errors)
    description_i18n = require_string_map(metadata, "descriptionI18n", REQUIRED_LOCALES, errors)
    require_tags(metadata, errors)

    if slug and skill_dir.name != slug:
        warnings.append(f"directory name '{skill_dir.name}' does not match slug '{slug}'")

    if summary and summary_i18n and summary_i18n.get("en") != summary:
        warnings.append("summary differs from summaryI18n.en")

    if description and description_i18n and description_i18n.get("en") != description:
        warnings.append("description differs from descriptionI18n.en")

    return report(skill_dir, errors, warnings)


def report(skill_dir: Path, errors: list[str], warnings: list[str]) -> int:
    print("Marketplace skill validation")
    print(f"Skill dir: {skill_dir}")
    print(f"Errors: {len(errors)}")
    print(f"Warnings: {len(warnings)}")

    for error in errors:
        print(f"- [error] {error}")
    for warning in warnings:
        print(f"- [warn] {warning}")

    if not errors:
        print("Result: OK")
        return 0

    print("Result: FAILED")
    return 1


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate a local marketplace skill before publish/update.")
    parser.add_argument("--skill-dir", required=True, help="Path to the local skill directory")
    parser.add_argument(
        "--verify-api-base",
        action="append",
        default=[],
        help="Verify exact remote file paths and SHA-256 values; repeat for canonical and mirror APIs",
    )
    parser.add_argument(
        "--wait-seconds",
        type=float,
        default=0,
        help="Wait up to this many seconds for each remote source to reach exact parity",
    )
    parser.add_argument(
        "--poll-seconds",
        type=float,
        default=5,
        help="Polling interval while waiting for remote publication parity",
    )
    args = parser.parse_args()
    skill_dir = Path(args.skill_dir).resolve()
    local_result = validate_skill_dir(skill_dir)
    if local_result != 0 or not args.verify_api_base:
        return local_result

    metadata = read_json(skill_dir / "marketplace.json")
    slug = require_non_empty_string(metadata, "slug", [])
    if not slug:
        return 1

    verification_errors: list[str] = []
    for api_base in args.verify_api_base:
        errors = wait_for_remote_file_parity(
            skill_dir,
            slug,
            api_base,
            args.wait_seconds,
            args.poll_seconds,
        )
        if errors:
            verification_errors.extend(errors)
        else:
            print(f"Remote file parity: OK ({api_base})")

    for error in verification_errors:
        print(f"- [error] {error}")
    if verification_errors:
        print("Remote publication result: FAILED")
        return 1
    print("Remote publication result: OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
