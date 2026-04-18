# v0.16.63-impeccable-marketplace-skill

## 迭代完成说明

- 新增官方 marketplace skill：[`skills/impeccable/SKILL.md`](../../../skills/impeccable/SKILL.md)
  - 将上游 [pbakaus/impeccable](https://github.com/pbakaus/impeccable) 适配为 NextClaw 风格的单入口 skill：统一收口 design context、shape、craft、critique、audit、polish、extract 与 focused-pass 路由。
  - 明确「bundled local references / workflows」与「可选 upstream detector CLI」的职责边界，避免把第三方扫描器伪装成 NextClaw 内建能力。
- 新增 bundled references 与 workflow 资产：[`skills/impeccable/references`](../../../skills/impeccable/references) 与 [`skills/impeccable/workflows`](../../../skills/impeccable/workflows)
  - 内置 typography、color-and-contrast、spatial-design、motion-design、interaction-design、responsive-design、ux-writing，以及 critique 的 scoring/persona 参考文件。
  - 仅保留最有价值、最适合 NextClaw marketplace 的本地资产，没有把上游网站、浏览器扩展、provider-specific 安装包或 detector 源码一并复制进仓库。
- 新增 marketplace 元数据：[`skills/impeccable/marketplace.json`](../../../skills/impeccable/marketplace.json)
  - 补齐中英双语 `summary` / `description`、作者、标签、`sourceRepo` 与 `homepage`。
- 新增上游版权与来源说明：[`skills/impeccable/UPSTREAM_LICENSE`](../../../skills/impeccable/UPSTREAM_LICENSE)、[`skills/impeccable/UPSTREAM_NOTICE.md`](../../../skills/impeccable/UPSTREAM_NOTICE.md)、[`skills/impeccable/references/SOURCES.md`](../../../skills/impeccable/references/SOURCES.md)。
- 已完成正式官方上架：
  - package name：`@nextclaw/impeccable`
  - alias / slug：`impeccable`
  - publish 输出：`✓ Published new skill: @nextclaw/impeccable`，`Alias: impeccable`，`Files: 21`

## 测试/验证/验收方式

- 本地 metadata 校验：

```bash
python3 .agents/skills/marketplace-skill-publisher/scripts/validate_marketplace_skill.py --skill-dir skills/impeccable
```

- 实际结果：通过，`Errors: 0`，`Warnings: 0`，`Result: OK`。

- 正式发布：

```bash
nextclaw skills publish skills/impeccable \
  --meta skills/impeccable/marketplace.json \
  --scope nextclaw \
  --api-base https://marketplace-api.nextclaw.io
```

- 实际结果：成功创建 `@nextclaw/impeccable`。

- 远端条目核验：

```bash
curl -sS 'https://marketplace-api.nextclaw.io/api/v1/skills/items/impeccable' | jq '{ok, slug: .data.slug, packageName: .data.packageName, install: .data.install.kind}'
curl -sS 'https://marketplace-api.nextclaw.io/api/v1/skills/items/%40nextclaw%2Fimpeccable' | jq '{ok, slug: .data.slug, packageName: .data.packageName, install: .data.install.kind, summaryZh: .data.summaryI18n.zh, updatedAt: .data.updatedAt}'
```

- 实际结果：alias 路径与 scoped 包路径均返回 `ok=true`；`slug=impeccable`，`packageName=@nextclaw/impeccable`，`install.kind=marketplace`，`updatedAt=2026-04-18T04:01:49.259Z`。

- 非仓库目录安装冒烟：

```bash
TMP_DIR=$(mktemp -d /tmp/nextclaw-impeccable.XXXXXX)
nextclaw skills install @nextclaw/impeccable --api-base https://marketplace-api.nextclaw.io --workdir "$TMP_DIR"
nextclaw skills install impeccable --api-base https://marketplace-api.nextclaw.io --workdir "$TMP_DIR"
find "$TMP_DIR/skills/impeccable" -maxdepth 3 -type f | sort
rm -rf "$TMP_DIR"
```

- 实际结果：`@nextclaw/impeccable` 与 alias `impeccable` 两种安装方式均成功，临时目录中含 `SKILL.md`、`marketplace.json`、`UPSTREAM_LICENSE`、`UPSTREAM_NOTICE.md`、`references/*`、`workflows/*`，文件总数与发布内容一致。

- 治理 / 可维护性验证：

```bash
pnpm lint:maintainability:guard
pnpm lint:new-code:governance
pnpm check:governance-backlog-ratchet
```

- 实际结果：
  - `pnpm lint:maintainability:guard` 未通过，但阻塞项来自当前 worktree 内与本次 skill 无关的既有/并行改动：`packages/nextclaw-core/src/agent` 目录预算越界。
  - `pnpm lint:new-code:governance` 未通过，但阻塞项同样来自本次变更范围外的已触达文件命名问题，如 `apps/platform-admin/src/App.tsx`、`apps/platform-admin/src/pages/AdminDashboardPage.tsx`、`packages/nextclaw-ui/src/components/config/ChannelForm.tsx`。
  - `pnpm check:governance-backlog-ratchet` 通过，未出现治理债务反弹。

## 发布/部署方式

- 本次已完成官方 publish，后续若修改 [`skills/impeccable`](../../../skills/impeccable) 并需同步远端，默认使用：

```bash
nextclaw skills update skills/impeccable \
  --meta skills/impeccable/marketplace.json \
  --scope nextclaw \
  --api-base https://marketplace-api.nextclaw.io
```

- 首次上架或重新创建条目时使用：

```bash
nextclaw skills publish skills/impeccable \
  --meta skills/impeccable/marketplace.json \
  --scope nextclaw \
  --api-base https://marketplace-api.nextclaw.io
```

- 发布后远端核验：

```bash
curl -sS 'https://marketplace-api.nextclaw.io/api/v1/skills/items/%40nextclaw%2Fimpeccable'
```

- 安装冒烟必须在非仓库目录执行：

```bash
TMP_DIR=$(mktemp -d /tmp/nextclaw-impeccable.XXXXXX)
nextclaw skills install @nextclaw/impeccable --api-base https://marketplace-api.nextclaw.io --workdir "$TMP_DIR"
nextclaw skills install impeccable --api-base https://marketplace-api.nextclaw.io --workdir "$TMP_DIR"
find "$TMP_DIR/skills/impeccable" -maxdepth 3 -type f | sort
rm -rf "$TMP_DIR"
```

## 用户/产品视角的验收步骤

1. 在 NextClaw marketplace 中搜索 `Impeccable`，或直接用 `@nextclaw/impeccable` / `impeccable` 定位该 skill，确认摘要和详情页有完整中英文文案。
2. 执行 `nextclaw skills install @nextclaw/impeccable` 或 `nextclaw skills install impeccable`，确认本地出现 `skills/impeccable/SKILL.md`、`references/*`、`workflows/*`。
3. 在对话中请求前端设计、design critique、UI audit、polish 或 design-system extraction 时，助手应优先使用该 skill，而不是退回无上下文、无设计边界的通用回答。
4. 当用户只需要设计指导时，助手应直接利用 bundled references 工作，而不是强制要求先安装 upstream detector CLI。
5. 当用户要求自动 anti-pattern 扫描时，助手应先检查 `node` / `npm` / `npx` / `impeccable` 是否可用；若 detector 未就绪，应明确说明缺口并给出安装路径，而不是假装扫描已经完成。

## 可维护性总结汇总

- 本次是否已尽最大努力优化可维护性：是。上游项目本身包含 skill、18 个 commands、网站、扩展、detector、provider-specific 分发目录；本次只抽取适合 marketplace 的最小闭环资产，没有把无关站点构建、扩展代码和多 harness 分发物一起引入。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。最终采用的是“一个 router skill + 分角色 references/workflows + 可选 detector runtime”结构，而不是复制一整套上游命令树或硬塞多个并列 skill。
- 代码增减报告：
  - 新增：2331 行
  - 删除：0 行
  - 净增：+2331 行
- 非测试代码增减报告：
  - 新增：2331 行
  - 删除：0 行
  - 净增：+2331 行
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：未做到下降。文件数净增 21 个、非测试内容净增 2331 行；但这部分增长是把上游设计方法论本地化为可安装 skill 的最小必要成本。相较于复制完整上游仓库或继续新增多个并列 marketplace skill，这次已经明显收敛了体积与后续漂移面。
- 若出现净增长，其最小必要性以及同步偿还的维护性债务：净增长主要来自 bundled reference 文档与 workflow 文档；同步偿还的债务是把上游 `impeccable` 从“多工具分发 + 命令体系”收口为 NextClaw 能稳定消费的一套统一入口，减少未来出现多份适配层、命令散落、安装边界不清的问题。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：是。边界明确为：`SKILL.md` 负责路由与体验契约，`references/*` 负责设计知识，`workflows/*` 负责任务方法，upstream detector CLI 只在显式需要且环境就绪时参与；没有新增脚本、service 或补丁式运行时兼容层。
- 目录结构与文件组织是否满足当前项目治理要求：满足。新增内容被完整隔离在 `skills/impeccable/`，并按 `references/` 与 `workflows/` 分角色组织，命名均为 kebab-case。
- 若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：不适用。本次未触达业务源码、测试源码或运行链路脚本，主要新增的是 marketplace skill 资产与文档型 reference/workflow 文件；可维护性结论基于结构性人工复核与治理命令结果整理，不单独执行 `post-edit-maintainability-review`。
- 额外说明：`pnpm lint:maintainability:guard` 与 `pnpm lint:new-code:governance` 的失败均来自当前 worktree 中本次 skill 范围外的并行改动，不是 `skills/impeccable/` 新增内容导致。

## NPM 包发布记录

- 不涉及 NPM 包发布。
