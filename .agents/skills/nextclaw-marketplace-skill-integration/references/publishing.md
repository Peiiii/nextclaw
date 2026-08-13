# Marketplace Skill 发布

## 概述

这个 skill 用于把本地 skill 稳定地发布到本项目的 marketplace，并完成默认用户路径的闭环验证。发布命令成功只证明 canonical 写入完成；官方文件清单、国内默认读源和真实安装更新全部闭合后，才能报告发布完成。默认优先走本仓库已有 CLI：

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
python3 .agents/skills/nextclaw-marketplace-skill-integration/scripts/validate-marketplace-skill.py --skill-dir skills/<slug>
```

3. 先判断远端是否已经存在。若是更新，必须在发布前通过默认读源保留一份旧安装，用于发布后的真实 update 验收：

```bash
smoke_dir=$(mktemp -d /tmp/nextclaw-marketplace-skill.XXXXXX)
node packages/nextclaw/dist/cli/app/index.js skills install <slug> --workdir "$smoke_dir"
```

若是首次发布，只创建 `smoke_dir`，等远端一致后再安装。

4. 若 marketplace 中还没有该 skill，执行发布：

```bash
node packages/nextclaw/dist/cli/app/index.js skills publish skills/<slug> --meta skills/<slug>/marketplace.json --api-base https://marketplace-api.nextclaw.io
```

5. 若 skill 已存在，执行更新：

```bash
node packages/nextclaw/dist/cli/app/index.js skills update skills/<slug> --meta skills/<slug>/marketplace.json --api-base https://marketplace-api.nextclaw.io
```

6. 发布后先做远端元数据校验：

```bash
curl -sS https://marketplace-api.nextclaw.io/api/v1/skills/items/<slug>
```

观察点：
- 返回 `200`
- `summaryI18n.en` / `summaryI18n.zh` 存在
- `descriptionI18n.en` / `descriptionI18n.zh` 存在
- `install.kind` 为 `marketplace`

7. 使用同一个确定性校验器等待官方源和国内默认读源达到精确文件一致。该检查比较完整相对路径集合和每个文件的 SHA-256，不允许只看 `updatedAt`、详情 `200` 或发布命令的 `Files: N`：

```bash
python3 .agents/skills/nextclaw-marketplace-skill-integration/scripts/validate-marketplace-skill.py \
  --skill-dir skills/<slug> \
  --verify-api-base https://marketplace-api.nextclaw.io \
  --verify-api-base https://api.nextclaw.net \
  --wait-seconds 900 \
  --poll-seconds 10
```

任何一个源出现缺文件、额外文件、旧哈希或超时都属于发布未闭环。国内源不一致时检查镜像同步任务与 manifest；不要用显式官方源安装成功替代默认源验收。

8. 通过产品默认读源做真实安装/更新冒烟，必须在非仓库目录执行：

- 首次发布：在第 3 步创建的 `smoke_dir` 中执行默认源安装。
- 更新发布：复用发布前的旧安装执行一次默认源 update，必须观察到 `updated: true`；立即再执行一次，必须是 `updated: false / up-to-date`。

```bash
# 首次发布
node packages/nextclaw/dist/cli/app/index.js skills install <slug> --workdir "$smoke_dir"

# 更新发布
node packages/nextclaw/dist/cli/app/index.js marketplace skills update <slug> --workdir "$smoke_dir" --json
node packages/nextclaw/dist/cli/app/index.js marketplace skills update <slug> --workdir "$smoke_dir" --json

# 两类发布都要验证最终安装目录与远端完全一致
python3 .agents/skills/nextclaw-marketplace-skill-integration/scripts/validate-marketplace-skill.py \
  --skill-dir "$smoke_dir/skills/<slug>" \
  --verify-api-base https://api.nextclaw.net
rm -rf "$smoke_dir"
```

如果 `packages/nextclaw/dist/cli/app/index.js` 不存在，先构建 `packages/nextclaw`，不要退回旧的 `dist/cli/index.js` 路径。

## 默认判断

- 如果远端 `GET /api/v1/skills/items/<slug>` 返回 `404`，默认执行 `publish`
- 如果远端已存在该 skill，默认执行 `update`
- 如果本地缺少 `marketplace.json`，先补文件，再发布
- 如果 `marketplace.json` 缺少中文或英文文案，先补齐，再发布
- 官方源与国内默认读源没有达到精确文件一致时，状态仍是“canonical 已写入、发布未闭环”，不得报告完成

## 输出要求

最终结果至少要包含：

- 本地校验是否通过
- 执行的是 `publish` 还是 `update`
- 官方源与国内默认读源的文件数、路径集合和哈希一致性
- 默认读源安装或旧版本 update 的结果，以及第二次 update 的幂等结果
- 如失败，明确卡在哪一步，以及下一步需要什么条件

## 注意事项

- 优先使用 `marketplace.json`，不要把 marketplace 多语言元数据继续塞回 CLI 参数。
- 若当前环境没有 `NEXTCLAW_MARKETPLACE_ADMIN_TOKEN`，也要先尝试发布；只有远端明确拒绝时再报告鉴权阻塞。
- 不要在仓库目录内做安装冒烟。
- 不要把 `--api-base https://marketplace-api.nextclaw.io` 用在最终用户路径冒烟；它只能用于 canonical 诊断。
- 如果这次任务触达项目代码、脚本、测试或运行链路配置，完成当前发布 slice 后返回生命周期，由独立 Review 阶段执行 maintainability 自动检查和 findings 关闭。

## 资源

- `scripts/validate-marketplace-skill.py`：校验 skill 目录与 `marketplace.json` 的确定性脚本
