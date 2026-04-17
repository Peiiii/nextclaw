# Marketplace Username Readiness Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 把“个人 skill 发布前必须先有平台 username”从一个后端隐性前置条件，收敛成一个用户能发现、AI 能正确引用、CLI 能自助完成、网页能直达完成的正式产品能力。

**Architecture:** 继续以 `nextclaw-provider-gateway-api` 的 `user.username` 作为唯一身份源，不另造账号体系。产品面收敛为三层入口：`NextClaw Web` 作为用户主入口、桌面/本地 `Account Panel` 作为上下文快捷入口、CLI 作为脚本化和无 UI 场景的自助兜底。Marketplace 发布链路不再自行发明模糊提示，而是消费同一套“username readiness contract”。

**Tech Stack:** `apps/platform-console` React + TanStack Query、`packages/nextclaw-ui` React + Zustand、`packages/nextclaw` CLI、`workers/nextclaw-provider-gateway-api`、marketplace publish skill docs。

---

## 1. 问题定义

这次暴露出来的不是一个错链接，而是一条发布主链路的产品断裂：

1. 后端已经支持 `PATCH /platform/auth/profile` 设置 username。
2. 本地 UI 的 `Account Panel` 已经有 username 设置入口。
3. 平台网页 `platform.nextclaw.io` 作为用户账号站点，却没有同等可发现的 username 设置入口。
4. CLI 内部有 `me` / `updateProfile` 能力，但没有对用户暴露成清晰命令。
5. 发布 skill 的 marketplace skill 只知道“让用户去平台里设置用户名”，却没有可验证、可点击、可兜底的准确路径。

结果是：能力存在，但没有一个“统一、自然、默认”的产品入口。  
这直接违背 `docs/VISION.md` 里的几个上位原则：

- 入口优先
- 意图优先
- 自感知优先
- 自治优先
- 统一体验优先

## 2. 核心判断

### 2.1 这不是后端缺能力，而是入口缺收敛

当前问题不是“username 功能还没做”，而是：

- 用户主心智入口不明确
- AI 指南缺少 canonical destination
- CLI 没有显式自助命令
- Web / Local / CLI 三个入口没有统一成一套完成路径

### 2.2 正确修法不是只改文案，而是建立“Username Readiness”产品面

我们需要把 username 看成“个人发布身份准备状态”，而不是一个孤立资料字段。  
凡是走个人 marketplace 发布的路径，都应该围绕同一个问题给出一致体验：

`你现在能不能发布个人 skill？如果不能，下一步在哪里完成？`

### 2.3 用户主入口应当是 NextClaw Web，不是裸域名和内部术语

此前账号设计已经明确：`platform.nextclaw.io` 可以是实现域名，但不应成为用户主心智。  
因此对用户和 AI 的统一文案都应收敛为：

- 中文：`NextClaw Web` / `网页版 NextClaw`
- 英文：`NextClaw Web`

域名只作为技术落点，不作为产品指导语本体。

## 3. 方案选项

### 方案 A：只修 skill 文案和链接

做法：

- 把 `nextclaw.io` 改成 `platform.nextclaw.io`
- 在 skill 里写更准确的解释

优点：

- 成本最低
- 见效最快

缺点：

- 仍然没有网页设置入口
- 仍然没有 CLI 自助入口
- 仍然要求 AI 和用户自己猜产品边界
- 下一次换入口或加 profile 页，文案仍会再次漂移

结论：

- 拒绝作为最终方案
- 只能作为同批次里的最小止血动作

### 方案 B：CLI 兜底优先，网页后补

做法：

- 先暴露 `nextclaw account` 或等效命令
- 发布失败时直接教用户走 CLI 设置 username

优点：

- 技术实现相对直
- 适合开发者用户

缺点：

- 与 `NextClaw Web` 作为统一账号入口的方向不一致
- 非 CLI 用户仍然会迷路
- 对 marketplace 新用户不够自然

结论：

- 必须做，但不能单独作为产品答案

### 方案 C：统一 Username Readiness 产品面

做法：

- `NextClaw Web` 提供明确的 username/profile 入口
- 本地 `Account Panel` 与网页入口保持一致
- CLI 提供显式自助命令
- marketplace publish skill、CLI publish 错误、账号文案全部引用同一条完成路径

优点：

- 用户主链路完整
- AI 更容易给出稳定指导
- Web / Local / CLI 三端收敛
- 最符合“统一入口、统一体验、自治控制能力”的愿景

缺点：

- 改动面更广
- 需要同时动 Web、CLI、skill、文案

结论：

- 推荐方案

## 4. 目标状态

当用户或 AI 想发布个人 skill 时，系统应该表现成这样：

1. 用户执行发布。
2. 如果未登录：明确要求先登录 NextClaw Account。
3. 如果已登录但没有 username：
   - CLI 明确告诉用户“你还差 username”
   - 提供两个可执行完成路径：
     - `Open NextClaw Web account settings`
     - `Run nextclaw account set-username <name>`
4. 用户无论在 Web、本地 UI、还是 CLI，都能完成同一个字段设置。
5. 完成后，发布默认继续走 `@username/skill-name`。

AI 也应该稳定引用同一个答案：

`去 NextClaw Web 的账号设置页，或者直接用 nextclaw 的 account 命令设置 username。`

## 5. 交付范围

### 5.1 本轮必须完成

- Web：补齐 username 设置入口
- CLI：补齐显式自助命令
- Publish error：返回可执行下一步
- Skill docs：引用正确入口和备用路径
- Local Account Panel：与 Web 命名和跳转一致

### 5.2 本轮不做

- username 改名流程
- 复杂 profile 中心
- avatar / bio / public profile
- marketplace 审核流重设计

## 6. 执行任务

### Task 1: 收敛 canonical 产品入口与提示语

**Files:**
- Modify: `skills/publish-to-nextclaw-marketplace/SKILL.md`
- Modify: `packages/nextclaw/src/cli/skills/marketplace-identity.ts`
- Modify: `packages/nextclaw-ui/src/lib/i18n.remote.ts`
- Modify: `apps/platform-console/src/i18n/locales/en-US.json`
- Modify: `apps/platform-console/src/i18n/locales/zh-CN.json`
- Reference: `docs/plans/2026-03-21-nextclaw-account-and-remote-access-product-design.md`

**Steps:**
1. 把所有面对用户的“去平台设置 username”收敛成 `NextClaw Web` / `网页版 NextClaw`。
2. 在面向技术实现的地方保留真实域名 `https://platform.nextclaw.io`。
3. 统一文案语义：
   - `未登录`
   - `已登录但缺 username`
   - `username 已锁定`
   - `个人发布将使用 @username/skill-name`
4. 为后续 CLI / Web 共用提示准备同一套语言，不再出现：
   - `go to nextclaw.io`
   - `platform account ui or remote profile flow` 这种模糊表达

**Verification:**
- `rg -n "nextclaw.io|platform account UI|remote account profile flow" skills/publish-to-nextclaw-marketplace/SKILL.md packages/nextclaw/src/cli/skills/marketplace-identity.ts apps/platform-console/src packages/nextclaw-ui/src`
- 期望：面向用户的错误指引不再引用 landing 域名，也不再使用模糊入口名。

### Task 2: 在 NextClaw Web 中补齐 username 设置入口

**Files:**
- Modify: `apps/platform-console/src/pages/UserDashboardPage.tsx`
- Modify: `apps/platform-console/src/api/client.ts`
- Modify: `apps/platform-console/src/api/types.ts`
- Modify: `apps/platform-console/src/App.tsx`
- Modify: `apps/platform-console/src/i18n/locales/en-US.json`
- Modify: `apps/platform-console/src/i18n/locales/zh-CN.json`
- Optional Create: `apps/platform-console/src/components/account/username-card.tsx`
- Optional Create: `apps/platform-console/src/components/account/username-card.test.tsx`
- Optional Modify: `apps/platform-console/package.json`

**Steps:**
1. 在登录后的 `UserDashboardPage` 顶部增加账号摘要卡。
2. 明确展示：
   - email
   - role
   - username
3. 如果 `username === null`：
   - 显示 warning 卡
   - 提供输入框和保存按钮
   - 保存后刷新 `me`
4. 如果 `username` 已存在：
   - 显示只读值
   - 明确“当前版本首次设置后不可改名”
5. URL 层如果需要单独入口，优先使用 `platform.nextclaw.io/account` 或 `platform.nextclaw.io/profile` 之一，但前端内部必须真实存在该语义页面，而不是任意 SPA 路由都返回 200 的假入口。

**Testing:**
- 如果 `apps/platform-console` 仍无测试基础设施：
  - 先补最小 `vitest + testing-library` 基础设施
- 至少覆盖：
  - username 缺失时显示输入态
  - 保存成功后显示只读态
  - 后端返回 `USERNAME_TAKEN` / `INVALID_USERNAME` 时错误可见

**Verification:**
- `pnpm -C apps/platform-console lint`
- `pnpm -C apps/platform-console tsc`
- 如引入测试：`pnpm -C apps/platform-console test`

### Task 3: 暴露 CLI 自助账号命令，消除“内部能力不可见”

**Files:**
- Modify: `packages/nextclaw/src/cli/index.ts`
- Modify: `packages/nextclaw/src/cli/commands/platform-auth.ts`
- Modify: `packages/nextclaw/src/cli/commands/platform-auth.test.ts`
- Optional Create: `packages/nextclaw/src/cli/commands/account.controller.ts`

**Steps:**
1. 不再把 `me()` / `updateProfile()` 只留在内部调用。
2. 对外暴露明确命令，推荐命名：
   - `nextclaw account status`
   - `nextclaw account set-username <username>`
3. 若为了兼容内部实现，也可暂时复用 `PlatformAuthCommands`，但用户可见命令名不建议继续暴露 `platform` 术语。
4. `status` 输出至少包含：
   - email
   - role
   - username
   - readiness: `ready-for-personal-publish | username-required`
5. `set-username` 成功后应回显最终账号状态，不只打印“ok”。

**Testing:**
- 为 `status` 和 `set-username` 增补单测
- 覆盖：
  - 正常返回 username
  - username 缺失
  - 后端 validation error

**Verification:**
- `pnpm -C packages/nextclaw test -- --run src/cli/commands/platform-auth.test.ts`
- 手动冒烟：
  - `pnpm -C packages/nextclaw exec tsx src/cli/index.ts account status`
  - `pnpm -C packages/nextclaw exec tsx src/cli/index.ts account set-username alice-dev`

### Task 4: 让 publish 链路返回真正可执行的下一步

**Files:**
- Modify: `packages/nextclaw/src/cli/skills/marketplace-identity.ts`
- Modify: `packages/nextclaw/src/cli/skills/marketplace.publish.test.ts`
- Optional Modify: `packages/nextclaw/src/cli/skills/marketplace.ts`
- Modify: `skills/publish-to-nextclaw-marketplace/SKILL.md`

**Steps:**
1. 将当前报错：
   - `Set your NextClaw username before publishing personal skills.`
   升级为包含下一步的错误。
2. 推荐输出结构：
   - 发生了什么
   - 为什么阻断
   - 两条完成路径
     - Web：`Open NextClaw Web account settings`
     - CLI：`nextclaw account set-username <name>`
3. skill 文档同步改为：
   - 优先引导用户去 NextClaw Web
   - 若用户在纯终端环境，直接走 CLI fallback
4. 不再让 skill 猜测 landing 域名或模糊 UI。

**Testing:**
- 更新 `marketplace.publish.test.ts`
- 断言 username 缺失错误中包含：
  - `NextClaw Web`
  - `nextclaw account set-username`

**Verification:**
- `pnpm -C packages/nextclaw test -- --run src/cli/skills/marketplace.publish.test.ts`

### Task 5: 对齐本地 Account Panel 与 NextClaw Web

**Files:**
- Modify: `packages/nextclaw-ui/src/account/components/account-panel.tsx`
- Modify: `packages/nextclaw-ui/src/account/managers/account.manager.ts`
- Modify: `packages/nextclaw-ui/src/components/remote/remote-access-page.tsx`
- Modify: `packages/nextclaw-ui/src/components/remote/remote-access-page.test.tsx`
- Modify: `packages/nextclaw-ui/src/lib/i18n.remote.ts`
- Optional Create: `packages/nextclaw-ui/src/account/components/account-panel.test.tsx`

**Steps:**
1. 保留本地 `Account Panel` 里的 username 设置能力。
2. 但把“查看我的设备”这类动作重新命名为更清晰的 `Open NextClaw Web` / `前往网页版`。
3. 当 `username` 缺失时，增加一个显式的网页入口按钮：
   - `在 NextClaw Web 中查看账号`
4. 避免用户把本地面板误解为唯一设置入口，也避免 AI 只知道一个隐藏入口。

**Testing:**
- 至少覆盖：
  - username 缺失时显示保存按钮
  - 点击 Web 入口时调用 `openNextClawWeb`

**Verification:**
- `pnpm -C packages/nextclaw-ui test -- --run src/components/remote/remote-access-page.test.tsx`
- `pnpm -C packages/nextclaw-ui lint`
- `pnpm -C packages/nextclaw-ui tsc`

### Task 6: 文档与验收闭环

**Files:**
- Modify: `docs/USAGE.md`
- Modify: `skills/publish-to-nextclaw-marketplace/SKILL.md`
- Modify: latest relevant iteration log under `docs/logs` only when implementation actually lands

**Steps:**
1. 在正式文档里补一节：
   - 什么是平台 username
   - 为什么个人发布需要它
   - Web 与 CLI 两种设置方式
2. marketplace publish skill 文档用这份文档作为 source of truth，不再自造说法。
3. 实际实现落地后，再按 `docs/logs` 规则决定是否合并到最近相关迭代，优先检查是否属于同批次续改。

**Verification:**
- 文档链接手动检查
- `rg -n "Set your NextClaw username|NextClaw Web|account set-username" docs skills packages`

## 7. 验收标准

以下全部满足才算问题真正解决：

1. 用户无需猜域名，也无需让 AI 猜入口。
2. `platform.nextclaw.io` 登录后，能直接完成 username 设置。
3. 本地 `Account Panel` 仍然可以完成 username 设置。
4. CLI 能显式查询账号状态并设置 username。
5. `skills publish` 在 username 缺失时给出两条可执行路径。
6. publish-to-nextclaw-marketplace skill 不再把用户引到 `nextclaw.io` landing。
7. 用户和 AI 都能稳定回答“去哪里设置 username”。

## 8. 风险与取舍

### 风险 1：Web 新增 profile 能力会让平台站职责膨胀

控制方式：

- 本轮只做 username readiness，不扩完整 profile 中心

### 风险 2：CLI 和 Web 双入口可能造成心智重复

控制方式：

- 明确 Web 是主入口
- CLI 是终端/自动化 fallback

### 风险 3：Local Account Panel 与 Web 继续漂移

控制方式：

- 统一命名
- 统一 readiness 文案
- 统一成功/失败条件

## 9. 推荐执行顺序

1. Task 1
2. Task 2
3. Task 3
4. Task 4
5. Task 5
6. Task 6

原因：

- 先定义 canonical vocabulary，避免边做边漂移
- 再补主入口 Web
- 再补 CLI fallback
- 再让 publish 链路消费这套入口
- 最后做本地 UI 对齐和文档收尾

## 10. 成功指标

### 定性指标

- AI 不再把用户引到 landing 域名
- 用户不再需要靠人工排查“到底去哪设置 username”
- 团队内部对“主入口 / fallback / 技术域名”有统一认知

### 定量指标

- username 缺失导致 publish 失败后，用户无需二次人工支持即可完成设置
- Web / CLI / 本地 UI 三条路径都能在一次尝试内完成 username 设置

Plan complete and saved to `docs/plans/2026-04-18-marketplace-username-readiness-plan.md`.
