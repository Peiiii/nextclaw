# NextClaw Skill Source Map

## Core Sources

### 1) NextClaw Main Repository (official)
- URL: https://github.com/Peiiii/nextclaw
- Use for: current project architecture, package boundaries, and skill integration style
- Notes: highest-priority source for NextClaw-compatible decisions

### 2) NextClaw Docs (official)
- URL: https://docs.nextclaw.io/
- Use for: user-facing capability baseline and doc alignment
- Notes: use to ensure imported/adapted skills match published behavior

### 3) OpenClaw Official Skills Repository
- URL: https://github.com/openclaw/skills
- Use for: canonical upstream skill patterns and reusable assets
- Notes: primary upstream reference for OpenClaw-style skill conventions

### 4) OpenClaw Main Repository
- URL: https://github.com/openclaw/openclaw
- Use for: upstream runtime behavior and architecture signals
- Notes: use to validate compatibility assumptions before adapting skills

### 5) Awesome OpenClaw Skills (community curated)
- URL: https://github.com/VoltAgent/awesome-openclaw-skills
- Use for: discovery of categorized resources and ecosystem navigation
- Notes: curated list quality depends on maintainer activity

### 6) skills.sh (Vercel ecosystem portal)
- URL: https://skills.sh/
- Use for: trend discovery and popularity signals
- Notes: ranking/discovery source, not authoritative for compatibility

### 7) OpenAI Skills Repository
- URL: https://github.com/openai/skills
- Use for: reference implementations and reusable skill patterns from OpenAI ecosystem
- Notes: evaluate compatibility and license before direct reuse in NextClaw

## Suggested Triage Checklist

For each candidate skill/repo, verify:

1. License compatibility with NextClaw usage model
2. Maintenance freshness (recent commits/releases)
3. Dependency complexity and runtime fit
4. Reuse type:
- direct reuse
- adapt into NextClaw style
- keep as external reference

## Suggested Search Queries

- `nextclaw skills github`
- `nextclaw skill ecosystem`
- `openclaw skill registry`  
- `openclaw skills github`  
- `awesome openclaw skills`  
- `site:github.com openclaw skill`
- `openai skills github`
