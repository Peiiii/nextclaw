# v0.16.58-marketplace-username-readiness

## 迭代完成说明（改了什么）

- 补齐 `apps/platform-console` 的账号入口闭环：
  - 首页新增 `NextClaw Account` 卡片，直接展示 email / username / role / personal scope / 标准账号地址。
  - 新增明确语义路由 `/account` 与 `/profile`，不再把“去哪里设置 username”留给用户猜。
  - 账号页支持直接提交 username，并把返回的新 token 与最新用户资料写回本地会话。
  - App header 新增 `My Instances / Account` 导航，账号页成为真实可发现入口。
- 顺手删掉 `platform-console` 里本地缓存 `user` 的冗余状态，不再通过 effect 镜像 query 结果，降低 session 与 UI 状态分叉风险。
- 补齐 CLI 兜底入口：
  - 新增 `nextclaw account status`
  - 新增 `nextclaw account set-username <username>`
  - 输出中直接给出 `https://platform.nextclaw.io/account` 与 CLI 兜底命令，用户不再只收到模糊报错。
- 补齐 marketplace publish 的 username 缺失报错与 skill 文档：
  - `packages/nextclaw/src/cli/skills/marketplace-identity.ts` 现在会给出准确 Web 地址与 CLI 替代命令。
  - [docs/plans/2026-04-18-marketplace-username-readiness-plan.md](/Users/peiwang/Projects/nextbot/docs/plans/2026-04-18-marketplace-username-readiness-plan.md) 对应的执行项已落地到产品、CLI、文档与 smoke。
  - `skills/publish-to-nextclaw-marketplace/SKILL.md` 现在明确 username 缺失时的两条具体路径。
- 对齐本地 UI 文案与跳转：
  - “查看我的设备 / View My Devices” 统一收敛成 `Open NextClaw Web`
  - 本地账号面板从按钮直接打开 `https://platform.nextclaw.io/account` 对应的账号页语义入口。
- 扩展 `scripts/smoke/platform-console-smoke.mjs`，把 `/account` 路由和 username 保存链路纳入真实冒烟。

## 测试/验证/验收方式

- `pnpm -C apps/platform-console tsc`
- `pnpm -C apps/platform-console lint`
- `pnpm -C apps/platform-console build`
- `pnpm -C packages/nextclaw test -- --run src/cli/commands/platform-auth.test.ts src/cli/skills/marketplace-identity.test.ts src/cli/skills/marketplace.publish.test.ts`
- `pnpm -C packages/nextclaw tsc`
- `pnpm -C packages/nextclaw exec eslint src/cli/index.ts src/cli/runtime.ts src/cli/commands/platform-auth.ts src/cli/commands/platform-auth.test.ts src/cli/commands/platform-auth-support/account-status.ts src/cli/skills/marketplace-identity.ts src/cli/skills/marketplace-identity.test.ts --max-warnings=0`
- `pnpm -C packages/nextclaw build`
- `pnpm -C packages/nextclaw-ui test -- --run src/components/remote/remote-access-page.test.tsx`
- `pnpm -C packages/nextclaw-ui tsc`
- `pnpm -C packages/nextclaw-ui exec eslint src/account/managers/account.manager.ts src/account/components/account-panel.tsx src/lib/i18n.remote.ts src/components/remote/remote-access-page.tsx src/components/remote/remote-access-page.test.tsx --max-warnings=0`
- `PLATFORM_CONSOLE_BASE_URL=http://127.0.0.1:4173 node scripts/smoke/platform-console-smoke.mjs`
  - 观察点：`/account` 可达、username 可保存、保存后 `@alice-dev/*` scope 可见、首页与中文切换都正常。
- CLI 定向冒烟（本地 mock platform service，隔离目录 `/tmp/nextclaw-account-smoke.*`）：
  - `node packages/nextclaw/dist/cli/index.js login --api-base http://127.0.0.1:38991/v1 --email publisher@example.com --password secret`
  - `node packages/nextclaw/dist/cli/index.js account status --api-base http://127.0.0.1:38991/v1`
  - `node packages/nextclaw/dist/cli/index.js account set-username alice-dev --api-base http://127.0.0.1:38991/v1`
  - 观察点：先看到 `Username: (not set)` 与 `https://platform.nextclaw.io/account`，再看到 `Publish readiness: ready` 与 `@alice-dev/*`。
- 治理与维护性：
  - `pnpm check:governance-backlog-ratchet`
  - `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths ...`
  - 结果：guard 通过，无新增 hard error。

补充说明：

- `pnpm -C packages/nextclaw lint` 与 `pnpm -C packages/nextclaw-ui lint` 的全量执行仍会被仓库内既有历史问题阻断；本次已改用触达文件级别 lint 验证，并保留原仓库现状不做越权清扫。

## 发布/部署方式

- Web 用户站已执行发布：
  - 命令：`pnpm deploy:platform:console`
  - 结果：成功，Cloudflare Pages 返回部署地址 `https://abd516b1.nextclaw-platform-console.pages.dev`
  - 额外核验：`curl -I https://abd516b1.nextclaw-platform-console.pages.dev/account` 返回 `200`
  - 额外核验：`curl -I https://platform.nextclaw.io/account` 返回 `200`
- marketplace skill 远端更新已尝试执行：
  - 本地校验：`python3 .agents/skills/marketplace-skill-publisher/scripts/validate_marketplace_skill.py --skill-dir skills/publish-to-nextclaw-marketplace`
  - 远端存在性核验：`GET https://marketplace-api.nextclaw.io/api/v1/skills/items/%40nextclaw%2Fpublish-to-nextclaw-marketplace` 返回 `200`
  - 更新命令：`node packages/nextclaw/dist/cli/index.js skills update skills/publish-to-nextclaw-marketplace --meta skills/publish-to-nextclaw-marketplace/marketplace.json --package-name @nextclaw/publish-to-nextclaw-marketplace --api-base https://marketplace-api.nextclaw.io`
  - 当前状态：未发布成功
  - 阻塞原因：当前环境缺少 `@nextclaw/*` 所需 admin 权限，CLI 明确返回 `Publishing to @nextclaw/* requires admin permission.`
  - 远端现状：该 skill 仍停留在本次前的已发布版本，`updatedAt` 为 `2026-04-09T18:44:10.244Z`

## 用户/产品视角的验收步骤

1. 打开 [https://platform.nextclaw.io/account](https://platform.nextclaw.io/account)。
2. 用一个还没有 username 的 NextClaw 账号登录。
3. 页面应直接看到 `NextClaw Account` 卡片、标准账号地址、CLI 兜底命令，以及“发布个人 skill 之前需要先设置用户名”的提示。
4. 输入一个合法 username 并保存。
5. 保存成功后，页面应显示个人 scope，例如 `@alice-dev/*`，并展示“个人发布已经解锁 / Personal publishing is unlocked”。
6. 在终端执行 `nextclaw account status`，应能看到和网页一致的 readiness 信息。
7. 在终端执行 `nextclaw account set-username <username>` 时，应成功写入并回显新的个人 scope。
8. 再执行 `nextclaw skills publish ...` 的个人发布链路时，如果仍缺 username，不应再只收到模糊报错，而应看到准确 Web 地址和 CLI 兜底命令。

## 可维护性总结汇总

- 本次是否已尽最大努力优化可维护性：是。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。
  - 已删减：移除了 `platform-console` 里对 `user` 的冗余本地 store 镜像，避免 query / store 双写。
  - 已收敛：把 CLI account status 的格式化与打印逻辑抽到 `platform-auth-support/account-status.ts`，避免继续把 `platform-auth.ts` 往上堆。
  - 已收敛：把 `platform-console` smoke 拆成 landing / account / open actions / archive lifecycle / locale switch 多个小步骤，避免单一超长冒烟函数继续膨胀。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：
  - 总代码净增：`+304` 行
  - 非测试代码净增：`+243` 行
  - 本次存在净增长，但属于最小必要增长，因为这是一次新增 Web 账号入口、CLI 命令、错误引导和真实 smoke 覆盖面的产品闭环补齐，而不是单点文案修正。
  - 已同步偿还的维护性债务：删除 `platform-console` 的冗余状态同步；把 CLI status/view 格式化逻辑拆出；把 smoke 大函数拆成小步骤，避免继续恶化。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰：
  - 是。Web 账号入口被收敛到单独的 `account-summary-card` 组件；CLI account status 被抽成独立 support helper；本地 UI 继续复用既有 `AccountManager` 而不是新增第二套入口逻辑。
  - 没有为了一个问题额外引入新的 store 或补丁式兜底层。
- 目录结构与文件组织是否满足当前项目治理要求：
  - 基本满足当前任务需要，但 `packages/nextclaw/src/cli`、`packages/nextclaw/src/cli/commands`、`packages/nextclaw-ui/src/lib`、`scripts/smoke` 仍处于目录预算预警或例外状态。
  - 本次未继续扩大这些目录的平铺度，仅在必要位置新增了一个 `platform-auth-support/account-status.ts` 支撑文件和一个 `account-summary-card.tsx`。
  - 下一步整理入口：若 account 相关 CLI 继续增长，应把 `account` 命令注册从 `src/cli/index.ts` 继续拆到独立 register 文件；若 platform console 继续扩张，应把账号、remote、billing 进一步分离出更明确的 feature 边界。
- 本次涉及代码可维护性评估，已基于独立于实现阶段的 `post-edit-maintainability-guard` 与二次主观复核填写。
- 长期目标对齐 / 可维护性推进：
  - 这次改动顺着“统一入口、更少分裂路径、更少用户自己兜底”的长期方向推进了一步，把 publish 的前置条件从“报错后自己猜去哪里”收敛成真实 Web 入口和 CLI 自助入口。
  - 仍保留的维护性观察点主要在几个历史大文件与大目录预算，不是这次新增引入的新债。
- 可维护性复核结论：通过
- 本次顺手减债：是
- 代码增减报告：
  - 新增：423 行
  - 删除：119 行
  - 净增：+304 行
- 非测试代码增减报告：
  - 新增：362 行
  - 删除：119 行
  - 净增：+243 行
- no maintainability findings

## NPM 包发布记录

- 本次是否需要发包：不需要。
- 原因：
  - 本次对外已完成的发布动作是 `apps/platform-console` 的 Web 部署，不是 NPM 包分发。
  - `packages/nextclaw` 与 `packages/nextclaw-ui` 的改动当前停留在仓库提交层，未进入本次 NPM release 批次。
- 当前状态：不涉及 NPM 包发布。
