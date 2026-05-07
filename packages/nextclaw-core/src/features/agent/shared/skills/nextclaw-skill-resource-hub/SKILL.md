---
name: nextclaw-skill-resource-hub
description: Curate NextClaw skill resources, including OpenClaw and community sources. Use when expanding NextClaw skills, planning reuse/adaptation, or building a skill roadmap.
metadata: {"nextclaw":{"emoji":"🧭"}}
---

# NextClaw Skill Resource Hub

Use this skill to discover, assess, and reuse high-signal resources for NextClaw skill expansion.

## Source Priority

Read and prioritize sources in this order:

1. NextClaw official repositories and docs (highest priority)
2. OpenClaw official repositories (upstream-compatible references)
3. Curated community lists with clear maintenance signals
4. Trend/ranking platforms (for discovery only, not source of truth)

Use `references/source-map.md` as the primary index.

## Workflow

1. Clarify scope:
- `reference-only`: collect links and notes
- `adapt`: identify candidates for adaptation into NextClaw built-in skills
- `import`: prepare concrete install/import actions

2. Build a candidate list from priority sources.

3. For each candidate, record:
- Repository URL and owner
- License
- Last update freshness
- Relevance to current NextClaw needs
- Recommendation: `reuse directly` / `adapt` / `reference only`

4. Produce a compact action plan:
- Top 3 to execute now
- Next 5 backlog candidates
- Risks and unknowns (license, maintenance, dependency weight)

## Guardrails

- Prefer official upstream behavior over community forks when conflicting.
- Do not treat popularity alone as quality; always check maintenance and license.
- Keep output practical: links + decision + immediate next step.

## Output Template

```markdown
## Skill Resource Scan

### Top 3 Now
1. <name> - <url>
   - Why: ...
   - Action: reuse/adapt/reference

### Backlog Candidates
- <name> - <url> - <one-line reason>

### Risks / Unknowns
- ...
```
