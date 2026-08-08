#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any


REQUIRED_TOP_LEVEL_FIELDS = (
    "slug",
    "name",
    "summary",
    "description",
    "author",
    "tags",
)

REQUIRED_LOCALES = ("en", "zh")


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
    args = parser.parse_args()
    return validate_skill_dir(Path(args.skill_dir).resolve())


if __name__ == "__main__":
    sys.exit(main())
