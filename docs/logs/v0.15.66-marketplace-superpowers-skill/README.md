# v0.15.66-marketplace-superpowers-skill

## 迭代完成说明

- 新增 marketplace skill：`skills/superpowers`
  - 新增 NextClaw 入口 `SKILL.md`，将 `obra/superpowers` 适配为适合 NextClaw marketplace 的单入口 workflow skill。
  - 采用“单 skill 路由 + 本地 bundled references”方式集成，而不是强行复刻上游原生的多目录自动发现结构。
- 新增 `skills/superpowers/marketplace.json`
  - 补齐 slug、名称、中英双语 summary / description、标签、作者、来源仓库与主页信息。
- 打包关键上游流程参考到 `skills/superpowers/references/`
  - `brainstorming.md`
  - `writing-plans.md`
  - `test-driven-development.md`
  - `systematic-debugging.md`
  - `requesting-code-review.md`
  - `verification-before-completion.md`
  - `subagent-driven-development.md`
- 新增 `skills/superpowers/references/SOURCES.md`，记录每个 bundled reference 对应的上游路径与 GitHub URL，降低后续同步成本。
- 新增 `skills/superpowers/UPSTREAM_LICENSE`，保留上游 MIT 许可证。
- 已通过项目 CLI 将该 skill 首次发布到 NextClaw marketplace，并完成远端查询与非仓库目录安装冒烟闭环。

## 测试 / 验证 / 验收方式

- 本地 metadata 校验：

```bash
python3 .agents/skills/marketplace-skill-publisher/scripts/validate_marketplace_skill.py --skill-dir skills/superpowers
```

- 首次上架前远端存在性检查：

```bash
curl -sS https://marketplace-api.nextclaw.io/api/v1/skills/items/superpowers
```

结果：
- 返回 `404`
- `{"code":"NOT_FOUND","message":"skill item not found: superpowers"}`

- 首次上架：

```bash
PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw dev:build skills publish /Users/peiwang/Projects/nextbot/skills/superpowers --meta /Users/peiwang/Projects/nextbot/skills/superpowers/marketplace.json --api-base https://marketplace-api.nextclaw.io
```

结果：
- `✓ Published new skill: superpowers`
- `Files: 11`

- marketplace 远端校验：

```bash
curl -sS https://marketplace-api.nextclaw.io/api/v1/skills/items/superpowers
```

观察点：
- 返回 `ok: true`
- `slug = superpowers`
- `summaryI18n.en` / `summaryI18n.zh` 存在
- `descriptionI18n.en` / `descriptionI18n.zh` 存在
- `install.kind = marketplace`
- `publishedAt` / `updatedAt = 2026-04-09T12:22:34.822Z`

- marketplace 安装冒烟（非仓库目录）：

```bash
tmp_dir=$(mktemp -d /tmp/nextclaw-marketplace-skill.XXXXXX)
PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw dev:build skills install superpowers --api-base https://marketplace-api.nextclaw.io --workdir "$tmp_dir"
find "$tmp_dir/skills/superpowers" -maxdepth 2 -type f | sort
python3 .agents/skills/marketplace-skill-publisher/scripts/validate_marketplace_skill.py --skill-dir "$tmp_dir/skills/superpowers"
rm -rf "$tmp_dir"
```

结果：
- 安装成功输出 `✓ Installed superpowers (marketplace)`
- 安装目录包含 `SKILL.md`、`marketplace.json`、`UPSTREAM_LICENSE`、`references/SOURCES.md` 以及 7 份 bundled workflow references
- 安装后的二次 metadata 校验通过，`Errors: 0`，`Warnings: 0`

- maintainability guard：

```bash
PATH=/opt/homebrew/bin:$PATH pnpm lint:maintainability:guard
```

结果：
- 命令通过
- `Errors: 0`
- 仅有 1 条历史目录 warning，与本次改动无关：
  - `packages/nextclaw-ui/src/components/chat` 目录文件数预算 warning

- `build / lint / tsc`：
  - 不适用。本次未触达 TypeScript 业务源码、构建产物实现、前后端运行逻辑或类型链路，改动集中在 marketplace skill 内容、元数据与发布动作。

## 发布 / 部署方式

- 本次已首次上架：

```bash
PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw dev:build skills publish /Users/peiwang/Projects/nextbot/skills/superpowers --meta /Users/peiwang/Projects/nextbot/skills/superpowers/marketplace.json --api-base https://marketplace-api.nextclaw.io
```

- 当前发布结果：
  - marketplace slug：`superpowers`
  - 安装命令：`nextclaw skills install superpowers`
  - 远端查询：`https://marketplace-api.nextclaw.io/api/v1/skills/items/superpowers`

- 若后续需要更新远端条目，使用：

```bash
PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw dev:build skills update /Users/peiwang/Projects/nextbot/skills/superpowers --meta /Users/peiwang/Projects/nextbot/skills/superpowers/marketplace.json --api-base https://marketplace-api.nextclaw.io
```

## 用户 / 产品视角的验收步骤

1. 在任意 NextClaw workspace 或项目目录执行：

```bash
nextclaw skills install superpowers
```

2. 安装后检查本地 skill 目录：
   - 应出现 `skills/superpowers/SKILL.md`
   - 应出现 `skills/superpowers/marketplace.json`
   - 应出现 `skills/superpowers/references/` 下的 workflow references

3. 在对话中提出一个开发工作流需求，例如：
   - 先帮我把这个功能需求做成设计
   - 先别修，先系统化排查这个 bug
   - 给我一个实现计划，再按计划推进
   - 在说完成前先把验证跑一遍

4. 验收点：
   - AI 会先把任务分类到设计、规划、TDD、调试、review 或验证路径
   - AI 会优先加载最小必要的 bundled reference，而不是一次性吞掉整套文档
   - AI 不会把上游 superpowers 规则冒充成高于本仓库 `AGENTS.md` 的硬规则
   - 如果当前环境不支持多 agent，AI 会跳过 `subagent-driven-development` 路径而不是假装可用

5. 如需确认来源，可打开 `skills/superpowers/references/SOURCES.md`，核对 bundled references 对应的上游文件与 URL。

## 可维护性总结汇总

- 本次是否已尽最大努力优化可维护性：是。本次没有把 `obra/superpowers` 整仓库平铺复制进 marketplace，而是只打包对 NextClaw 单 skill 模型真正有用的少量上游 workflow references，并补了一层薄的入口路由与来源映射。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。相较于“尝试复刻上游原生多目录自动发现机制”或“本地重写整套 superpowers 内容”，本次采用了更简单的单入口 skill + references 方案，尽量少引入 NextClaw 专属分叉。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：部分做到了“最小必要增长”。这次新增了一个 skill 目录、7 份上游 reference、1 份来源映射、1 份许可证与 1 份迭代记录，属于把上游方法论作为可安装资产交付给 marketplace 的最小必要增长；同时避免了新增业务源码、适配器逻辑、脚本运行时或更多分层包装，减少后续维护面。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：是。职责边界保持清晰：
  - 上游 `obra/superpowers` reference 文件负责方法论内容本身
  - `skills/superpowers/SKILL.md` 只负责 NextClaw 入口路由、边界声明与引用策略
  - marketplace 元数据只负责上架与分发
  - 未引入额外运行时 wrapper、helper、service 或脚本层
- 目录结构与文件组织是否满足当前项目治理要求：是。新增内容收敛在 `skills/superpowers/`，迭代记录收敛在当前 `docs/logs/v0.15.66-marketplace-superpowers-skill/README.md`，没有扩散到业务源码目录。
- 若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：不适用。本次未触达业务代码、脚本实现或运行链路逻辑，主要是 skill 文档与 marketplace 元数据适配，因此未单独执行代码级 `post-edit-maintainability-review`。
- 若本次迭代不涉及代码可维护性评估，必须明确写“不适用”并说明理由：不适用。原因同上；本次核心是“以最小分叉把上游工作流打包为 marketplace skill”，并非代码结构重构。
