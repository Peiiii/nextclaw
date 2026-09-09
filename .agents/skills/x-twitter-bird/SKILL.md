---
name: x-twitter-bird
description: 当用户需要搜索或读取 X/Twitter，或通过真实浏览器及 bird CLI 发布、回复和核验帖子时使用；写作内容策略不由本 skill 负责。
---

# X / Twitter 读取与发布

## Primary contract

- Credentials live in a user-local file, not in the repo:
  - default path: `~/.nextclaw/secrets/x-bird.json`
- CLI 操作统一通过 `scripts/x-bird.mjs`；真实浏览器操作走当前可用的 Computer Use 工具，不受 CLI 路径限制。
- The script passes `--auth-token` and `--ct0` explicitly to `bird`
- 不依赖 bird 自动读取凭据环境变量；由 wrapper 显式传入。版本从实际解析到的 `@steipete/bird/package.json` 核对，不把历史版本当成本机现状。

## 操作路由

读取与搜索使用下方命令。发布、浏览器操作或 CLI 故障时，读取[发布路径与故障处理](references/publishing-paths.md)。已有发布授权不重复询问。

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

Post only after the user explicitly asks:

```bash
node .agents/skills/x-twitter-bird/scripts/x-bird.mjs tweet 'text here'
node .agents/skills/x-twitter-bird/scripts/x-bird.mjs reply <tweet-id-or-url> 'text here'
```

## Rules

- Treat `auth_token` and `ct0` as full login credentials
- Never write them into repo files, docs, tests, or iteration logs
- 发布授权按发布路径 reference 处理。已授权的稳定 minor 发布在发布核验及公共链接检查完成后直接执行，不重复确认。
- Stable minor release posts should include one public-safe, high-information image by default. Choose the best fit among a real product screenshot, a benchmark/release summary card, AI-generated campaign art, or an AI-assisted composition containing an unaltered real screenshot. Never present generated UI as a real product screenshot or change verified release facts. Patch releases do not post unless the user explicitly overrides this rule.
- When `HTTP_PROXY`/`HTTPS_PROXY` is required, invoke this wrapper with a Node version that supports environment proxies (for example `NODE_USE_ENV_PROXY=1 <node-24+> scripts/x-bird.mjs ...`). The wrapper launches `bird` with the same Node executable so the proxy setting reaches X requests.
- The wrapper refreshes current GraphQL query IDs before every `tweet` or `reply`. 报错后区分 query ID、网络、频率限制和 226，不把所有错误归为账号封控；后续操作遵守 reference 的查重与停止条件。
- A successful write response is not completion by itself. 通过浏览器详情或 wrapper 回读已知 ID，核对作者、完整正文及素材后才报告成功并记录 URL。缺少 ID、回读失败或内容不符不能盲目重发。多个平台分别报告状态，一个成功不代表整批完成；新发不隐含授权删除旧帖。
- Prefer `--json` for read/search workflows so downstream analysis stays structured
- If the user asks for only reading, do not post, like, follow, or unbookmark anything
