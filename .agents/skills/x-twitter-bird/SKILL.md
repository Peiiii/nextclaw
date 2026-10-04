---
name: x-twitter-bird
description: 当用户需要搜索或读取 X/Twitter、操作 X 账号，或希望扩大 X 账号的相关关注者时使用；账号增长下转专门 Skill，单篇内容写作另有 owner。
---

# X / Twitter 读取与发布交接

## Primary contract

- Credentials live in a user-local file, not in the repo:
  - default path: `~/.nextclaw/secrets/x-bird.json`
- 用户允许使用 CLI 时，读取与搜索通过 `scripts/x-bird.mjs`；用户禁用 bird 时，下方 CLI 示例全部不适用。真实浏览器的只读操作走当前可用的 Computer Use 工具。
- The script passes `--auth-token` and `--ct0` explicitly to `bird`
- 不依赖 bird 自动读取凭据环境变量；由 wrapper 显式传入。版本从实际解析到的 `@steipete/bird/package.json` 核对，不把历史版本当成本机现状。

## 操作路由

用户要扩大 X 账号的相关关注者时，先读取独立的 [X 账号受众增长 Skill](../../wiki/skills/strategy/x-audience-growth/SKILL.md)，由它决定目标、行动与复盘；本 Skill 只负责平台操作。用户允许 CLI 时可用下方读取命令，首次调用前核实实际解析到的 `bird` 是 `@steipete/bird`；出现 `Init Modele` 等无关帮助时按[发布交接与故障处理](references/publishing-paths.md)修正命令入口。发帖、回复、点赞、关注、浏览器操作或 CLI 故障时也读取该 reference。

## Setup

Store credentials once:

```bash
node .agents/skills/x-twitter-bird/scripts/x-bird.mjs auth set --auth-token '<token>' --ct0 '<token>'
```

Check the current account:

```bash
node .agents/skills/x-twitter-bird/scripts/x-bird.mjs whoami --plain
```

## Common commands

Read bookmarks:

```bash
node .agents/skills/x-twitter-bird/scripts/x-bird.mjs bookmarks -n 20 --json
```

Read likes:

```bash
node .agents/skills/x-twitter-bird/scripts/x-bird.mjs likes -n 20 --json
```

Search:

```bash
node .agents/skills/x-twitter-bird/scripts/x-bird.mjs search 'DeepSeek V4 reasoning_content' -n 10 --json
```

Read a tweet or thread:

```bash
node .agents/skills/x-twitter-bird/scripts/x-bird.mjs read <tweet-id-or-url> --json
node .agents/skills/x-twitter-bird/scripts/x-bird.mjs thread <tweet-id-or-url> --json
```

## Rules

- Treat `auth_token` and `ct0` as full login credentials
- Never write them into repo files, docs, tests, or iteration logs
- 用户授权发布不自动证明写入途径符合 X 规则。按发布交接 reference 判断可否执行；没有经核实可用的合规途径时交付可直接手动发布的成稿，不声称已发布。
- Stable minor release posts should include one public-safe, high-information image by default. Choose the best fit among a real product screenshot, a benchmark/release summary card, AI-generated campaign art, or an AI-assisted composition containing an unaltered real screenshot. Never present generated UI as a real product screenshot or change verified release facts. Patch releases do not post unless the user explicitly overrides this rule.
- When `HTTP_PROXY`/`HTTPS_PROXY` is required, invoke this wrapper with a Node version that supports environment proxies (for example `NODE_USE_ENV_PROXY=1 <node-24+> scripts/x-bird.mjs ...`). The wrapper launches `bird` with the same Node executable so the proxy setting reaches X requests.
- 226 只证明该次请求被拒；按 reference 查重和停止，不把它一概解释为账号封禁，也不换路径绕过。
- A successful write response is not completion by itself. 通过浏览器详情或 wrapper 回读已知 ID，核对作者、完整正文及素材后才报告成功并记录 URL。缺少 ID、回读失败或内容不符不能盲目重发。多个平台分别报告状态，一个成功不代表整批完成；新发不隐含授权删除旧帖。
- Prefer `--json` for read/search workflows so downstream analysis stays structured
- If the user asks for only reading, do not post, like, follow, or unbookmark anything
