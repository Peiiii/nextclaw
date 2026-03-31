# v0.15.0-skillhub-guide-skill

## 迭代完成说明

- 延续同一批次的 marketplace skill 集成工作，直接完善现有迭代记录，不新建更高版本目录。
- 新增并发布两个 marketplace skill：
  - [`skills/skillhub-guide/SKILL.md`](skills/skillhub-guide/SKILL.md)
  - [`skills/find-skills/SKILL.md`](skills/find-skills/SKILL.md)
- 补齐两个 skill 的 marketplace 元数据：
  - [`skills/skillhub-guide/marketplace.json`](skills/skillhub-guide/marketplace.json)
  - [`skills/find-skills/marketplace.json`](skills/find-skills/marketplace.json)
- 为 Skillhub skill 增加跨平台检查脚本：
  - [`skills/skillhub-guide/scripts/check-skillhub.sh`](skills/skillhub-guide/scripts/check-skillhub.sh)
  - [`skills/skillhub-guide/scripts/check-skillhub.ps1`](skills/skillhub-guide/scripts/check-skillhub.ps1)

### 本次实际完成的内容

1. `skillhub-guide`
   - 从“介绍页”收紧为 NextClaw 风格的可执行引导 skill。
   - 明确区分 NextClaw marketplace 与腾讯 Skillhub 的边界。
   - 默认推荐更可预测的 `CLI-only` 安装路径。
   - 补充就绪检查、搜索、安装、排障、宿主重启提醒。
   - 补充 Windows 说明：当前上游 Skillhub 官方安装器是 Bash 链路，Windows 下需通过 Git Bash、WSL 或等待上游提供原生安装器。

2. `find-skills`
   - 参考 Vercel `find-skills` 的能力定位，适配为 NextClaw marketplace skill。
   - 明确区分 NextClaw marketplace 与外部 open skills ecosystem。
   - 覆盖搜索、质量判断、推荐与安装命令说明。
   - 补充跨平台提示，明确 Windows 下如不适合 symlink 应优先考虑 `--copy`。

## 测试/验证/验收方式

### 本地验证

- Marketplace 元数据校验：

```bash
python3 .agents/skills/marketplace-skill-publisher/scripts/validate_marketplace_skill.py --skill-dir skills/skillhub-guide
python3 .agents/skills/marketplace-skill-publisher/scripts/validate_marketplace_skill.py --skill-dir skills/find-skills
```

- 结果：两个 skill 均 `Errors: 0`，`Warnings: 0`，`Result: OK`。

- Skillhub 检查脚本验证：

```bash
bash skills/skillhub-guide/scripts/check-skillhub.sh
```

- 结果：在当前机器未安装 `skillhub` 的情况下，脚本正确输出 `CLI-only` 安装命令、完整安装命令与后续使用提示。

- 可维护性守卫：

```bash
PATH=/opt/homebrew/bin:$PATH pnpm lint:maintainability:guard
```

- 结果：`Errors: 0`，`Warnings: 0`，治理检查通过。

### 实际上架与远端校验

- Publish：

```bash
PATH=/opt/homebrew/bin:$PATH node packages/nextclaw/dist/cli/index.js skills publish skills/skillhub-guide --meta skills/skillhub-guide/marketplace.json --api-base https://marketplace-api.nextclaw.io
PATH=/opt/homebrew/bin:$PATH node packages/nextclaw/dist/cli/index.js skills publish skills/find-skills --meta skills/find-skills/marketplace.json --api-base https://marketplace-api.nextclaw.io
```

- 输出：
  - `✓ Published new skill: skillhub-guide`，`Files: 4`
  - `✓ Published new skill: find-skills`，`Files: 2`

- 远端条目校验：
  - `GET https://marketplace-api.nextclaw.io/api/v1/skills/items/skillhub-guide` -> `ok: true`，`publishedAt=2026-03-31T13:15:19.085Z`
  - `GET https://marketplace-api.nextclaw.io/api/v1/skills/items/find-skills` -> `ok: true`，`publishedAt=2026-03-31T13:15:20.097Z`
  - 两个条目均返回 `install.kind=marketplace`

### 安装冒烟

- 非仓库目录安装冒烟：

```bash
tmp_dir=$(mktemp -d /tmp/nextclaw-marketplace-skillhub-guide.XXXXXX)
PATH=/opt/homebrew/bin:$PATH node packages/nextclaw/dist/cli/index.js skills install skillhub-guide --api-base https://marketplace-api.nextclaw.io --workdir "$tmp_dir"

tmp_dir=$(mktemp -d /tmp/nextclaw-marketplace-find-skills.XXXXXX)
PATH=/opt/homebrew/bin:$PATH node packages/nextclaw/dist/cli/index.js skills install find-skills --api-base https://marketplace-api.nextclaw.io --workdir "$tmp_dir"
```

- 结果：
  - `skillhub-guide` 安装成功，落地 `SKILL.md`、`marketplace.json`、`scripts/check-skillhub.sh`、`scripts/check-skillhub.ps1`
  - `find-skills` 安装成功，落地 `SKILL.md`、`marketplace.json`

## 发布/部署方式

- 本次两个 skill 已完成首次 `publish`。
- 后续如继续调整内容并同步远端，使用：

```bash
PATH=/opt/homebrew/bin:$PATH node packages/nextclaw/dist/cli/index.js skills update skills/skillhub-guide --meta skills/skillhub-guide/marketplace.json --api-base https://marketplace-api.nextclaw.io
PATH=/opt/homebrew/bin:$PATH node packages/nextclaw/dist/cli/index.js skills update skills/find-skills --meta skills/find-skills/marketplace.json --api-base https://marketplace-api.nextclaw.io
```

- 发布后建议继续执行：
  - 远端 `GET /api/v1/skills/items/<slug>` 校验
  - 非仓库目录 `skills install <slug>` 冒烟

## 用户/产品视角的验收步骤

1. 在 NextClaw marketplace 中搜索 `skillhub-guide`，能看到一个用于接入腾讯 Skillhub 的 skill。
2. 安装 `skillhub-guide` 后，用户能看到：
   - Skillhub 是什么
   - `CLI-only` 安装命令
   - 搜索与安装命令
   - Windows 下的 Bash 兼容层说明
   - Shell / PowerShell 两种检查方式
3. 在 NextClaw marketplace 中搜索 `find-skills`，能看到一个用于发现外部 open skills ecosystem 的 skill。
4. 安装 `find-skills` 后，用户能知道：
   - 什么时候应该优先用 NextClaw marketplace
   - 什么时候应该去 `skills.sh` / `npx skills`
   - 如何评估外部 skill 质量
   - Windows 下如不适合 symlink 可优先用 `--copy`
5. 用户可以基于两个 skill 完成以下闭环：
   - 了解 Skillhub 并安装其 CLI
   - 搜索 Skillhub skill 并按需安装
   - 搜索 open skills ecosystem 中的外部 skill，并获得准确的安装命令与边界说明

## 参考资料

- [腾讯 Skillhub 安装文档](https://skillhub-1388575217.cos.ap-guangzhou.myqcloud.com/install/skillhub.md)
- [Vercel find-skills 原始 skill](https://github.com/vercel-labs/skills/blob/main/skills/find-skills/SKILL.md)
- [Vercel Skills CLI README](https://github.com/vercel-labs/skills/blob/main/README.md)
