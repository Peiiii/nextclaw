---
name: marketplace-skill-publisher
description: 在本仓库将本地 skill 发布或更新到 NextClaw marketplace 时使用。适用于新增 marketplace skill、从 SkillHub 继承 skill 到本项目 marketplace、补齐 marketplace.json 双语元数据、执行发布后远端校验与安装冒烟。
---

# Marketplace Skill Publisher

## 概述

这个 skill 用于把本地 skill 稳定地发布到本项目的 marketplace，并完成最小闭环验证。默认优先走本仓库已有 CLI：

```bash
node packages/nextclaw/dist/cli/app/index.js skills publish <skill-dir> --meta <skill-dir>/marketplace.json --api-base <marketplace-api>
```

不要绕过 CLI 直接手写 admin API payload，除非 CLI 本身有缺陷需要修。

## 何时使用

- 新增一个 skill 到本项目 marketplace。
- 将 SkillHub 已安装 skill 继承到本项目 marketplace。
- 更新已上架 skill 的 marketplace 文案、标签或文件内容。
- 需要补齐 `marketplace.json` 的中英文元数据，并做上架后验证。

如果只是修改 skill 文案但不需要发布到 marketplace，不要用这个 skill。

## 输入约定

- 本地 skill 目录通常位于 `skills/<slug>`
- 目录至少包含：
  - `SKILL.md`
  - `marketplace.json`
- `marketplace.json` 默认必须包含：
  - `slug`
  - `name`
  - `summary`
  - `summaryI18n.en`
  - `summaryI18n.zh`
  - `description`
  - `descriptionI18n.en`
  - `descriptionI18n.zh`
  - `author`
  - `tags`

## 执行流程

1. 先确认 skill 目录与 slug：

```bash
find skills/<slug> -maxdepth 2 -type f | sort
```

2. 先做本地元数据校验：

```bash
python3 .agents/skills/marketplace-skill-publisher/scripts/validate_marketplace_skill.py --skill-dir skills/<slug>
```

3. 若 marketplace 中还没有该 skill，执行发布：

```bash
node packages/nextclaw/dist/cli/app/index.js skills publish skills/<slug> --meta skills/<slug>/marketplace.json --api-base https://marketplace-api.nextclaw.io
```

4. 若 skill 已存在，执行更新：

```bash
node packages/nextclaw/dist/cli/app/index.js skills update skills/<slug> --meta skills/<slug>/marketplace.json --api-base https://marketplace-api.nextclaw.io
```

5. 发布后做远端校验：

```bash
curl -sS https://marketplace-api.nextclaw.io/api/v1/skills/items/<slug>
```

观察点：
- 返回 `200`
- `summaryI18n.en` / `summaryI18n.zh` 存在
- `descriptionI18n.en` / `descriptionI18n.zh` 存在
- `install.kind` 为 `marketplace`

6. 发布后做安装冒烟，必须在非仓库目录执行：

```bash
tmp_dir=$(mktemp -d /tmp/nextclaw-marketplace-skill.XXXXXX)
node packages/nextclaw/dist/cli/app/index.js skills install <slug> --api-base https://marketplace-api.nextclaw.io --workdir "$tmp_dir"
find "$tmp_dir/skills/<slug>" -maxdepth 2 -type f | sort
rm -rf "$tmp_dir"
```

如果 `packages/nextclaw/dist/cli/app/index.js` 不存在，先构建 `packages/nextclaw`，不要退回旧的 `dist/cli/index.js` 路径。

## 默认判断

- 如果远端 `GET /api/v1/skills/items/<slug>` 返回 `404`，默认执行 `publish`
- 如果远端已存在该 skill，默认执行 `update`
- 如果本地缺少 `marketplace.json`，先补文件，再发布
- 如果 `marketplace.json` 缺少中文或英文文案，先补齐，再发布

## 输出要求

最终结果至少要包含：

- 本地校验是否通过
- 执行的是 `publish` 还是 `update`
- 远端校验结果
- 安装冒烟结果
- 如失败，明确卡在哪一步，以及下一步需要什么条件

## 注意事项

- 优先使用 `marketplace.json`，不要把 marketplace 多语言元数据继续塞回 CLI 参数。
- 若当前环境没有 `NEXTCLAW_MARKETPLACE_ADMIN_TOKEN`，也要先尝试发布；只有远端明确拒绝时再报告鉴权阻塞。
- 不要在仓库目录内做安装冒烟。
- 如果这次任务触达项目代码、脚本、测试或运行链路配置，收尾前记得执行 `post-edit-maintainability-guard`。

## 资源

- `scripts/validate_marketplace_skill.py`：校验 skill 目录与 `marketplace.json` 的确定性脚本
