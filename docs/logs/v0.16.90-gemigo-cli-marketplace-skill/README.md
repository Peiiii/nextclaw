# v0.16.90-gemigo-cli-marketplace-skill

## 迭代完成说明（改了什么）

- 新增 marketplace skill：[`skills/gemigo-cli/SKILL.md`](../../../skills/gemigo-cli/SKILL.md)
  - 以 `/Users/peiwang/Projects/deploy-your-app/skills/gemigo-cli/SKILL.md` 为基础，适配为 NextClaw marketplace 可直接交付的用户工作流。
  - 本次没有只照搬命令清单，而是补齐了 NextClaw 用户真正需要的闭环：
    - 明确区分 marketplace skill 安装 与 本机 `gemigo` CLI 安装
    - 明确 `gemigo` 当前只负责发布“已经构建好的静态产物目录”，不假装它能自动接管依赖安装和项目构建
    - 增加 `gemigo whoami` 为核心 readiness check
    - 增加对静态目录形态与 `gemigo.app.json` 的显式校验要求
    - 把真正的远端部署动作保留在显式确认之后
    - 要求部署成功后把 hosted URL / 域名明确返回给用户
- 新增 marketplace 元数据：[`skills/gemigo-cli/marketplace.json`](../../../skills/gemigo-cli/marketplace.json)
  - 补齐中英文 `summary` / `description`
  - 声明 `sourceRepo=https://github.com/Peiiii/deploy-your-app`
  - 声明 `homepage=https://gemigo.io`
- 已将该 skill 正式发布到 NextClaw marketplace：
  - canonical package：`@nextclaw/gemigo-cli`
  - alias：`gemigo-cli`
- 同批次续改：
  - 根据用户反馈，补强 marketplace 对普通用户可见的介绍文案，明确说明它可以部署的对象包括：Vite/React/Vue/Svelte/Astro 等前端静态构建产物、纯 HTML/CSS/JS 页面、落地页、作品集、Demo、原型、文档站和无需后端进程的小工具。
  - 同时明确排除未构建的源码仓库、服务端应用、API、数据库和仍需要后端进程运行的应用，避免用户误以为它是通用云部署平台。
  - 在 [`skills/gemigo-cli/SKILL.md`](../../../skills/gemigo-cli/SKILL.md) 新增 `What Users Can Deploy` 章节，让助手对用户解释时更直白。

## 测试/验证/验收方式

### 本地元数据校验

```bash
python3 .agents/skills/marketplace-skill-publisher/scripts/validate_marketplace_skill.py --skill-dir skills/gemigo-cli
```

- 结果：`Errors: 0`，`Warnings: 0`，`Result: OK`

### 发布验证

```bash
nextclaw skills publish skills/gemigo-cli --meta skills/gemigo-cli/marketplace.json --scope nextclaw --api-base https://marketplace-api.nextclaw.io
```

- 结果：
  - `✓ Published new skill: @nextclaw/gemigo-cli`
  - `Alias: gemigo-cli`
  - `Files: 2`

### 同批次文案更新验证

```bash
nextclaw skills update skills/gemigo-cli --meta skills/gemigo-cli/marketplace.json --package-name @nextclaw/gemigo-cli --api-base https://marketplace-api.nextclaw.io
```

- 结果：
  - `✓ Updated skill: @nextclaw/gemigo-cli`
  - `Alias: gemigo-cli`
  - `Files: 2`
- 远端 `updatedAt` 更新为 `2026-04-23T01:28:22.456Z`
- 远端中文描述已明确写出可部署对象：
  - Vite/React/Vue/Svelte/Astro 构建后的静态目录
  - 纯 HTML/CSS/JS 页面
  - 落地页、作品集、Demo、原型、文档站
  - 不需要后端进程的小工具

### 远端条目校验

```bash
curl -sS https://marketplace-api.nextclaw.io/api/v1/skills/items/%40nextclaw%2Fgemigo-cli
curl -sS https://marketplace-api.nextclaw.io/api/v1/skills/items/gemigo-cli
```

- 结果：
  - 两个入口都返回 `ok: true`
  - `packageName: @nextclaw/gemigo-cli`
  - `install.kind: marketplace`
  - 中英双语 `summaryI18n` / `descriptionI18n` 存在

### Marketplace 安装冒烟

```bash
tmp_dir=$(mktemp -d /tmp/nextclaw-marketplace-gemigo.XXXXXX)
nextclaw skills install gemigo-cli --api-base https://marketplace-api.nextclaw.io --workdir "$tmp_dir"
find "$tmp_dir/skills/gemigo-cli" -maxdepth 3 -type f | sort
rm -rf "$tmp_dir"
```

- 结果：
  - 安装成功
  - 落地文件包含：
    - `SKILL.md`
    - `marketplace.json`

### 可维护性守卫

```bash
node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths skills/gemigo-cli/SKILL.md skills/gemigo-cli/marketplace.json
```

- 结果：`Maintainability check not applicable: no changed code-like files found.`

## 发布/部署方式

1. 本次 skill 已完成正式发布，当前线上 canonical package 为 `@nextclaw/gemigo-cli`
2. 若后续只更新 skill 文案或元数据，执行：

```bash
nextclaw skills update skills/gemigo-cli --meta skills/gemigo-cli/marketplace.json --scope nextclaw --api-base https://marketplace-api.nextclaw.io
```

3. 更新后继续执行以下最小闭环：

```bash
curl -sS https://marketplace-api.nextclaw.io/api/v1/skills/items/gemigo-cli
tmp_dir=$(mktemp -d /tmp/nextclaw-marketplace-gemigo.XXXXXX)
nextclaw skills install gemigo-cli --api-base https://marketplace-api.nextclaw.io --workdir "$tmp_dir"
rm -rf "$tmp_dir"
```

## 用户/产品视角的验收步骤

1. 在 NextClaw marketplace 中搜索 `gemigo-cli` 或 `GemiGo CLI`
2. 安装该 skill
3. 阅读 skill 内容后，用户应能清楚理解：
  - 这是通过本机 `gemigo` CLI 交付的能力，不是 NextClaw 内建部署内核
  - 它当前发布的是“已经构建好的静态目录”，不是原始源码仓库
  - 真正 deploy 前会先检查 `gemigo` 是否已安装、是否已登录、静态目录是否合法、`gemigo.app.json` 是否完整
  - 真正的远端部署动作应该在用户确认后执行
4. 当用户让 NextClaw 帮他发布一个小应用时，助手应按 skill 约束：
  - 先 build 或定位产物目录
  - 再做 `gemigo whoami`
  - 再校验 `gemigo.app.json`
  - 最后才执行 `gemigo deploy`
5. 发布成功后，助手应把托管 URL / 域名返回给用户，而不是只说“命令执行成功”

## 可维护性总结汇总

- 是否已尽最大努力优化可维护性：是
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是
  - 本次没有改 NextClaw 核心 CLI、marketplace API 或 UI，也没有新加包装脚本、helper 或 service
  - 能力被限制在 `skills/gemigo-cli/` 目录内，以最小边界完成集成
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：是
  - 新增只有 2 个 skill 文件和 1 个迭代 README
  - 没有把复杂度推进到核心产品代码路径
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：是
  - Skill 层只负责用户旅程、环境检查、确认规则与故障提示
  - 运行时能力仍明确归属 `gemigo` CLI，自始至终没有假装成 NextClaw 自己的原生 deploy runtime
- 目录结构与文件组织是否满足当前项目治理要求：是
  - 新增内容位于 `skills/gemigo-cli/` 与单独迭代目录中，未引入新的组织噪音
- 若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：不适用
  - 原因：本次未触达项目代码、构建链路实现、测试实现或运行时逻辑，只新增 marketplace skill 内容与迭代记录
- 长期目标对齐 / 可维护性推进：
  - 本次是在强化 NextClaw 作为“统一入口 + 能力编排”的定位，让用户通过 marketplace 获取“发布自己构建的小应用并拿到可访问 URL”这类外部能力
  - 同时保持边界清晰，没有把部署能力硬塞回核心产品，而是通过 marketplace skill 封装成可发现、可引导、可诊断的外部能力入口

## NPM 包发布记录

- 不涉及 NPM 包发布
