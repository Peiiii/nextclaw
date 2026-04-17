# v0.16.43-hermes-runtime-marketplace-skill

## 迭代完成说明

- 将现有内建 skill [`packages/nextclaw-core/src/agent/skills/hermes-runtime/SKILL.md`](../../../packages/nextclaw-core/src/agent/skills/hermes-runtime/SKILL.md) 收口为适合 marketplace 安装后的自洽版本。
  - 删除对仓库内私有设计文档路径的依赖。
  - 补充「marketplace skill 与外部 Hermes 可执行文件」的安装边界说明，避免安装后出现“skill 已装好但 Hermes 二进制并未就绪”的误解。
- 新增 marketplace 元数据 [`packages/nextclaw-core/src/agent/skills/hermes-runtime/marketplace.json`](../../../packages/nextclaw-core/src/agent/skills/hermes-runtime/marketplace.json)。
  - 补齐中英双语 `summary` / `description`、作者、标签、上游仓库与主页。
- 已将该 skill 作为官方 skill 上架到 NextClaw marketplace。
  - 官方包名：`@nextclaw/hermes-runtime`
  - alias / slug：`hermes-runtime`
- 由于当前机器没有现成的 marketplace admin token，但存在可用的 Cloudflare Wrangler owner 权限，本次通过旋转 `nextclaw-marketplace-api` 的 `MARKETPLACE_ADMIN_TOKEN` 恢复官方发布能力，再完成正式 publish。

## 测试/验证/验收方式

- 本地 metadata 校验：

```bash
python3 .agents/skills/marketplace-skill-publisher/scripts/validate_marketplace_skill.py --skill-dir packages/nextclaw-core/src/agent/skills/hermes-runtime
```

- 发布后远端校验：

```bash
curl -sS https://marketplace-api.nextclaw.io/api/v1/skills/items/hermes-runtime
curl -sS https://marketplace-api.nextclaw.io/api/v1/skills/items/%40nextclaw%2Fhermes-runtime
```

- 非仓库目录安装冒烟：

```bash
TMP_DIR=$(mktemp -d /tmp/nextclaw-marketplace-hermes-runtime.XXXXXX)
node packages/nextclaw/dist/cli/index.js skills install @nextclaw/hermes-runtime --api-base https://marketplace-api.nextclaw.io --workdir "$TMP_DIR"
find "$TMP_DIR/skills/hermes-runtime" -maxdepth 2 -type f | sort
rm -rf "$TMP_DIR"
```

- 治理 / 可维护性验证：

```bash
pnpm lint:maintainability:guard
pnpm check:governance-backlog-ratchet
```

实际结果：

- `validate_marketplace_skill.py` 通过，`Errors: 0`，`Warnings: 0`。
- 远端 `GET` 返回 `200`，`packageName=@nextclaw/hermes-runtime`，`install.kind=marketplace`，中英双语文案齐全。
- 安装冒烟通过，临时目录中仅包含 `SKILL.md` 与 `marketplace.json`。
- `pnpm lint:maintainability:guard` 通过；仅报告仓库内既有维护性预警，无本次新增错误。
- `pnpm check:governance-backlog-ratchet` 通过。

## 发布/部署方式

- 本次已完成正式官方发布。
- 本次实际发布链路：

```bash
cd workers/marketplace-api
wrangler secret put MARKETPLACE_ADMIN_TOKEN

cd /Users/peiwang/Projects/nextbot
node packages/nextclaw/dist/cli/index.js skills publish \
  packages/nextclaw-core/src/agent/skills/hermes-runtime \
  --meta packages/nextclaw-core/src/agent/skills/hermes-runtime/marketplace.json \
  --scope nextclaw \
  --token <rotated-admin-token> \
  --api-base https://marketplace-api.nextclaw.io
```

- 后续若需要更新该官方 skill，默认使用：

```bash
node packages/nextclaw/dist/cli/index.js skills update \
  packages/nextclaw-core/src/agent/skills/hermes-runtime \
  --meta packages/nextclaw-core/src/agent/skills/hermes-runtime/marketplace.json \
  --scope nextclaw \
  --token <current-admin-token> \
  --api-base https://marketplace-api.nextclaw.io
```

- 若当前 admin token 已不可追溯，且仍由本团队 owner 维护，可再次通过具备 `workers/secrets` 写权限的 Wrangler 登录态旋转 `MARKETPLACE_ADMIN_TOKEN` 后再执行 update。

## 用户/产品视角的验收步骤

1. 打开 marketplace，确认能看到官方 skill `Hermes Runtime`。
2. 执行 `nextclaw skills install @nextclaw/hermes-runtime`，确认本地出现 `skills/hermes-runtime/SKILL.md`。
3. 在 NextClaw 中请求安装 / 接入 Hermes runtime 时，助手应优先使用该 skill，而不是回到 API server 优先或 connector 优先的旧叙事。
4. 按 skill 的冷启动流程执行时，助手应先检查 `hermes` 与 `hermes acp` 是否存在，再写入或修复 `agents.runtimes.entries.hermes`，最后跑真实 reply smoke。
5. 若 Hermes runtime 已正确接入，用户应能在正式会话类型里看到 `Hermes`，并通过 skill 引导完成安装、诊断与修复闭环。

## 可维护性总结汇总

- 可维护性复核结论：通过。
- 长期目标对齐 / 可维护性推进：本次顺着“少一份重复文案、少一条安装后 surprise 路径、让官方交付面更收敛”的方向推进了一小步。相比新增一个独立 `skills/hermes-runtime` 副本，本次直接复用 `packages/nextclaw-core` 里的现有 skill 源目录，只补 marketplace 所需最小元数据与自洽说明，避免形成双份内容漂移。
- 本次是否已尽最大努力优化可维护性：是。在可发布范围内，已经优先选择“复用现有 skill 源目录”而不是复制一份 marketplace 包；剩余增长只来自必要的元数据文件和少量边界说明。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。没有新增新的 skill 副本、没有引入新的 marketplace 打包脚本、没有修改 publish CLI 逻辑；仅通过现有 CLI、现有 worker secret 机制和现有 skill 源目录完成上架。
- 代码增减报告：
  - 新增：44 行
  - 删除：3 行
  - 净增：+41 行
- 非测试代码增减报告：
  - 新增：44 行
  - 删除：3 行
  - 净增：+41 行
- 若总代码或非测试代码净增长，是否已做到最佳删减：是。净增长由两部分构成：`marketplace.json` 新文件 27 行，以及 `SKILL.md` 为 marketplace 安装场景补齐的 17 行说明；这部分增长已经是把内建 skill 变成可上架官方 skill 的最小必要补充。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：基本做到。文件数仅净增 1 个必要元数据文件，没有新增新的目录层级，也没有引入新的脚本、类、helper 或额外 runtime 代码。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：是。本次没有改动运行时实现边界，只把 `hermes-runtime` 的交付边界描述得更清楚，保持“skill 负责 onboarding，runtime 负责执行”的原有职责分层。
- 目录结构与文件组织是否满足当前项目治理要求：满足当前范围要求。`hermes-runtime` 仍位于 `packages/nextclaw-core/src/agent/skills/hermes-runtime/`，与现有内建 skill 组织一致；本次没有再额外复制到 `skills/` 下制造第二份来源。
- post-edit-maintainability-review 结论：
  - 本次顺手减债：是。
  - no maintainability findings
  - 保留债务经说明接受：仓库内仍存在与本次无关的既有维护性预警，例如 `stdio-runtime.service.ts` 超预算和 `scripts/governance` 目录过宽，但本次未新增相关债务。
