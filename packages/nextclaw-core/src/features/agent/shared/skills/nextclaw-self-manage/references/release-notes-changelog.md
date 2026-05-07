# Release Notes / Changelog Lookup

Use this reference when user asks for version changes (latest or specific version).

## Deterministic Lookup Order

1. Resolve package + version first.
- latest version:
  - `npm view <pkg> dist-tags.latest`
- publish time:
  - `npm view <pkg> time --json`

2. Read package changelog in repository.
- `packages/nextclaw/CHANGELOG.md`
- `packages/nextclaw-ui/CHANGELOG.md`
- If a git tag exists, you can pin to tag snapshot:
  - `git show <tag>:packages/<package-dir>/CHANGELOG.md`

3. Fallback to iteration logs when changelog is generic.
- Search detailed logs:
  - `docs/logs/**/v<version>-*/README.md`
- Extract: what changed, validation, release/deploy notes.

4. Build answer with traceable references.
- Must include:
  - package name
  - target version
  - source file path(s) used
- If details are insufficient, explicitly say so and point to the missing source.

## Output Template

```text
<pkg> <version> (published at <time>) changed:
1) ...
2) ...
Sources:
- packages/.../CHANGELOG.md
- docs/logs/.../README.md
```

