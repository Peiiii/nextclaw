# NextClaw UI 产物发布闭包与补发

## 迭代完成说明

本次纠正 `@nextclaw/ui@0.15.18` 发布后普通 NextClaw 用户仍无法获得最新 UI 的问题，并补发顶层 `nextclaw@0.27.5`。

根因分为四层：

- 直接触发：原 changeset 只包含 `@nextclaw/ui` 与 `@nextclaw/ncp-react`，没有包含顶层 `nextclaw`。
- 产物链路：`nextclaw` 构建时把 UI 复制到自身发布包的 `ui-dist`；registry 中的 `@nextclaw/ui` 不是产品运行时依赖。
- 防线缺口：release health 只检查各 package 目录内的源码漂移，Changesets 也不会沿 devDependency 推导构建产物消费者，因此原发布批次可以通过现有检查。
- 系统原因：正确的 UI/顶层包绑定只存在于可绕过的 `release:frontend` 专用脚本和人工判断中，没有进入 generic release scope 的强制合同。

端到端确认方式是对比当前 UI 构建产物、`nextclaw@0.27.4` tag 中的 `ui-dist` 与 registry 依赖：顶层包保留旧 UI hash，且不依赖已发布的 UI 包。修复把产物依赖收敛到共享 release scope，自动 changeset 会展开 `@nextclaw/ui -> nextclaw`，发布分组检查会阻断缺少顶层消费者的批次。

## 测试/验证/验收方式

- `node --test scripts/release/release-scope.test.mjs`：覆盖 UI 产物消费者展开与缺失闭包报告。
- 临时单包 changeset 反例：`pnpm release:check:groups` 明确阻断缺少 `nextclaw` 的 UI 发布批次。
- 同一反例下运行 `pnpm release:auto:changeset -- --check`：自动选择缺失的 `nextclaw`。
- `pnpm release:auto:changeset -- --check --package @nextclaw/ui`：只以 UI 为显式种子，并展开为 UI 与顶层包，不扫描无关公共包。
- 发布前后继续记录 package build、pack、registry、隔离安装与 stable runtime update 验收结果。

## 发布/部署方式

- NPM：通过仓库 Changesets 发布流程补发 `nextclaw@0.27.5`。
- Stable runtime update：顶层 NPM 发布后通过 `pnpm release:stable:runtime` 发布并验证。
- 产品更新说明：中英文页面与结构化 JSON 已准备，runtime manifest 使用对应英文页面 URL。
- Docs Deploy：随主干发布链路公开版本说明。
- 桌面 installer、数据库 migration 与后端部署：不适用，本次不涉及这些交付面。

## 用户/产品视角的验收步骤

1. 从旧版 NPM 安装态检查 stable 更新，确认发现 `0.27.5`。
2. 下载并应用更新，确认新进程报告 `0.27.5`。
3. 新建会话并切换 Agent Runtime，确认恢复用户最近为该 Runtime 选择的模型。
4. 手动压缩上下文，确认立即出现进行中反馈并在完成后清理。
5. 发送消息并模拟实时连接恢复，确认当前消息即时出现且遗漏消息能补回。

## 可维护性总结汇总

- 删除独立的 `release-frontend.mjs` changeset writer，前端命令复用共享 release scope。
- 发布闭包只有一个事实 owner；自动补全与阻断检查读取同一份产物依赖。
- `release:frontend` 使用显式 UI 种子，避免全仓漂移扫描扩大发布范围。
- 定向 ESLint、new-code governance、backlog ratchet、maintainability guard 与主观复核结果在发布前补齐。

## NPM 包发布记录

- `@nextclaw/ncp-react@0.5.16`：已发布，`latest` 已验证。
- `@nextclaw/ui@0.15.18`：已发布，`latest` 已验证。
- `nextclaw@0.27.5`：待版本化、发布与 registry 验证。
- Stable runtime update：待 NPM 发布后闭合。
