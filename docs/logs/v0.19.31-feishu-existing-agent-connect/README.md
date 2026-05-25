# v0.19.31 Feishu Existing Agent Connect

## 迭代完成说明

本次新增“连接已有飞书智能体”能力，保留原有扫码创建新智能体入口，并在飞书渠道配置中提供“创建新智能体 / 连接已有智能体”两个清晰入口。已有智能体连接只要求用户填写平台、App ID 和 App Secret；平台入口文案使用“平台”，不再使用“区域”。

根因：原链路只有 `scan-to-create` 路径，Feishu extension 通过扫码注册 API 创建新的 PersonalAgent，没有 extension runtime / server / client / UI 的 `channel.auth.connect` 合同，也没有把现有 App ID + Secret 验证后写入渠道配置的 owner。用户本地“点开始连接后一直等待中”的接口层原因，是运行中的 Feishu extension 子进程仍加载旧 dist，旧进程没有 `channel.auth.connect` handler，runtime 请求最终超时。

确认方式：使用测试 App ID 和 Secret 直接调用飞书 `tenant_access_token/internal` 与 `bot/v3/info` 成功，返回智能体名称 `Pei的智能助手`；再通过 `FeishuAccountConnectionService.connect()` 成功写入临时 NEXTCLAW_HOME；最后在本地 NextClaw API `POST /api/config/channels/feishu/auth/connect` 成功返回 `authorized`。

修复方式：新增 core extension auth `connect` 合同，贯通 kernel extension runtime、server config API、client SDK、UI hook 与 Feishu extension owner service；Feishu QR 注册成功后的账号持久化也复用新的 `FeishuAccountConnectionService`，避免 QR 创建和已有连接两套写入逻辑分叉。

## 测试/验证/验收方式

- `pnpm -C packages/extensions/nextclaw-channel-extension-feishu tsc`
- `pnpm -C packages/nextclaw-kernel tsc`
- `pnpm -C packages/nextclaw-server tsc`
- `pnpm -C packages/nextclaw-core tsc`
- `pnpm -C packages/nextclaw-client-sdk tsc`
- `pnpm -C packages/nextclaw-ui tsc`
- `pnpm -C packages/nextclaw-core build`
- `pnpm -C packages/nextclaw-server build`
- `pnpm -C packages/extensions/nextclaw-channel-extension-feishu build`
- `pnpm -C packages/nextclaw-client-sdk build`
- `pnpm -C packages/extensions/nextclaw-channel-extension-feishu exec vitest run src/tests/feishu-account-connection.service.test.ts src/tests/feishu-registration.service.test.ts src/tests/feishu-auth-capability.service.test.ts`
- `pnpm -C packages/nextclaw-ui exec vitest run src/features/channels/components/config/weixin-channel-auth-section.test.tsx src/features/channels/components/config/channel-form.test.tsx src/features/channels/utils/channel-form-fields.utils.test.ts`
- `pnpm -C packages/nextclaw-kernel exec vitest run src/services/extension-runtime.service.test.ts`
- `pnpm -C packages/nextclaw-extension-sdk exec vitest run src/extension-sdk.test.ts`
- 针对改动文件运行 ESLint，均通过。
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs`
- 飞书官方 API 真实凭据冒烟：token 获取成功，bot info 获取成功。
- 本地 NextClaw API 冒烟：`POST /api/config/channels/feishu/auth/connect` 返回 `authorized`。

已知验证限制：Chrome DevTools MCP 因本机 profile lock 未能完成浏览器截图验收；对应 UI 行为已通过组件测试覆盖。

## 发布/部署方式

未执行发布。当前变更需要随下一次常规应用/扩展构建发布，Feishu extension dist 已在本地重新 build，确保本地运行进程可加载 `channel.auth.connect` handler。

## 用户/产品视角的验收步骤

1. 打开飞书渠道配置。
2. 进入“连接已有智能体”。
3. 选择平台：Feishu 或 Lark。
4. 点击“打开飞书开发者后台”或 “Open Lark developer console”，进入智能体/应用列表获取 App ID 与 App Secret。
5. 填入 App ID 与 App Secret，点击“验证并连接”。
6. 成功后渠道状态变为已授权，并能看到已连接智能体名称。
7. 回到“创建新智能体”仍可使用原扫码创建流程。

## 可维护性总结汇总

本次是新增用户可见能力，非测试代码净增为正，属于必要增长。实现前删除了 Feishu QR 注册链路里原本直接持久化账号和探测 bot 的重复逻辑，把 QR 创建成功和已有智能体连接统一收敛到 `FeishuAccountConnectionService`；extension runtime 只新增一个 `connect` 合同入口，server/client/UI 均沿用既有 channel auth 分层。

`post-edit-maintainability-guard` 已运行，通过但有 7 个历史/趋势 warning：client SDK services、server app、UI shared api 等目录或文件接近预算或已有目录预算压力。本次没有新增这些目录的直接文件，新增 Feishu 连接 owner 落在 extension service 边界；后续若继续扩展飞书渠道，优先拆分 `weixin-channel-auth-section.tsx` 的混合职责，并治理 `shared/lib/api/utils` 的 flat mixed directory。

代码增减报告：总计新增 767 行，删除 126 行，净增 641 行。非测试代码新增 554 行，删除 125 行，净增 429 行。

## NPM 包发布记录

不涉及 NPM 包发布。
