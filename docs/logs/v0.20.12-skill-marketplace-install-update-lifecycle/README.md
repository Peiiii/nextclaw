# v0.20.12-skill-marketplace-install-update-lifecycle

## 迭代完成说明

- 补齐 marketplace skill 安装后的生命周期闭环：安装时在 skill 目录写入 `.nextclaw-install.json`，记录 marketplace slug、packageName、远端 updatedAt、安装时间和文件 sha256。
- 新增已安装 marketplace skill 更新能力：
  - `nextclaw marketplace skills update <slug>` 更新本地已安装 skill。
  - 若本地文件自安装后被修改，普通 update 会拒绝覆盖，必须显式 `--force`。
- UI marketplace 已安装 skill 卡片增加 update 管理动作；server marketplace manage action 支持 `update`，service installer 复用 CLI 子命令执行。
- 将 marketplace 前端 API 类型从超长 `types.ts` 拆到 `marketplace.types.ts`，将 skill install/update lifecycle 从发布工具模块拆到 `utils/marketplace-skill-lifecycle.utils.ts`。
- 将 `.nextclaw-install.json` 读写、文件 hash/drift 判断收敛到 `stores/marketplace-install-state.store.ts`，让 marketplace client 回到 API 与文件下载职责。
- 同步更新 `docs/USAGE.md`、打包资源 `packages/nextclaw/resources/USAGE.md` 与 `nextclaw-self-manage` skill，使 AI 自管理入口知道 `update` 命令。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/service tsc`：通过。
- `pnpm --filter @nextclaw/service test -- src/cli/commands/skills/marketplace.install.test.ts`：通过，覆盖安装状态文件、update 应用、本地漂移拒绝覆盖、网络重试。
- `pnpm --filter nextclaw tsc`：通过。
- `pnpm --filter @nextclaw/server test -- src/app/router.marketplace-manage.test.ts src/app/router.marketplace-content.test.ts`：通过。
- `pnpm --filter @nextclaw/ui test -- src/features/marketplace/components/marketplace-page.test.tsx src/features/marketplace/components/marketplace-page-detail.test.tsx`：通过。
- targeted ESLint：
  - service 触达文件：通过。
  - server marketplace 触达文件：通过。
  - UI marketplace / api / i18n 触达文件：无错误，保留 `marketplace-installed-cache.utils.ts` 既有参数解构 warning。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths ...`：通过；保留若干文件接近预算与历史目录预算 warning。
- `pnpm check:governance-backlog-ratchet`：通过。
- `pnpm lint:new-code:governance`：仍被无关工作区改动 `packages/nextclaw-core/src/features/config/configs/schema.ts` 的既有命名/角色问题阻塞；本次 marketplace 触达文件的命名问题已修复。
- `pnpm --filter @nextclaw/server tsc` 与 `pnpm --filter @nextclaw/ui tsc` 已执行，但被当前工作区无关 provider/config WIP 类型错误阻塞，未作为本次功能通过证据。

## 发布/部署方式

本次未执行发布或部署。需要随下一次 NextClaw runtime / desktop / NPM 发布批次进入用户环境。

## 用户/产品视角的验收步骤

1. 在非仓库临时 workdir 安装 marketplace skill，确认 skill 目录包含 `SKILL.md` 与 `.nextclaw-install.json`。
2. marketplace 远端 updatedAt 变新后运行 `nextclaw marketplace skills update <slug> --workdir <dir>`，确认本地文件更新、状态文件刷新。
3. 手动修改已安装 skill 文件后再次 update，确认普通更新拒绝覆盖，并提示使用 `--force`。
4. 打开 UI marketplace 已安装技能页，确认 marketplace 来源的 skill 出现 update 动作，执行后服务端返回更新结果。

## 可维护性总结汇总

- 本次是新增用户能力，非测试代码净增是生命周期能力本身所需；未按非功能改动的 `非测试净增 <= 0` 硬门槛收尾。
- 正向减债动作：
  - 将前端 marketplace 类型从超长 `api/types.ts` 拆到 `marketplace.types.ts`。
  - 将 skill install/update lifecycle 从 `marketplace.utils.ts` 拆到 `utils/marketplace-skill-lifecycle.utils.ts`，避免发布工具模块继续膨胀。
  - 将安装状态读写与 drift 判断从 `marketplace-client.ts` 拆到 `stores/marketplace-install-state.store.ts`，降低 client 文件的混合职责。
  - 将 i18n marketplace 标签文件改名为 `marketplace-labels.utils.ts`，满足文件角色命名治理。
- maintainability guard 无错误；遗留 warning 主要是已有目录预算压力与新增 lifecycle 文件接近 400 行预算。后续继续扩展 skill lifecycle 时，应优先收敛 install/update 主流程，而不是把新分支继续塞回 client。

## NPM 包发布记录

不涉及 NPM 包发布。
