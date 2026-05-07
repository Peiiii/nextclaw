# GitHub Release Template

Use this when writing a formal GitHub Release note for NextClaw desktop or npm releases.

## Required structure

1. `English Version` must come first.
2. `中文版` must come second.
3. Keep the same information density in both languages.
4. Do not repeat `Full Changelog` multiple times.
5. Prefer a short `Highlights` section over a long unstructured paragraph.

## Recommended sections

```md
## English Version

One-line release positioning.

Launcher version: `...`
Bundle version: `...`

### Highlights
- ...
- ...
- ...

### Validation Summary
- ...
- ...

### Notes
- ...
- ...

**Full Changelog**: <compare-link>

## 中文版

一句话版本定位。

Launcher 版本：`...`
Bundle 版本：`...`

### 亮点
- ...
- ...
- ...

### 验证摘要
- ...
- ...

### 说明
- ...
- ...

**完整变更**: <compare-link>
```

## Writing guidance

- `Highlights` should stay user-facing and product-facing, not become a raw commit dump.
- If this is a desktop stable release, call out installer/update validation explicitly.
- If this is a release-closure follow-up, say what mismatch was fixed and what is now aligned again.
- Keep the changelog link only once per language block.
- If the release is unsigned, opening guidance can go under `Notes / 说明`.
