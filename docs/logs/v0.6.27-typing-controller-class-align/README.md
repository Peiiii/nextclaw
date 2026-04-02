# 2026-02-19 v0.6.27-typing-controller-class-align

## 迭代完成说明

- 目标：一次性修复 Discord（并同步 Telegram）在 AI 不回复时 typing 指示可能长期悬挂的问题，并对齐“class 优于 create 函数”的实现偏好。
- 本次完成：
  - 新增 `ChannelTypingController` class，统一管理 typing 的启动、心跳、自动回收与清理：
    - `packages/extensions/nextclaw-channel-runtime/src/channels/typing-controller.ts`
  - Discord 接入 class 控制器：
    - 统一通过 `ChannelTypingController` 管理 typing 生命周期。
    - AI 不回复场景下由 `autoStop` 自动回收 typing，避免一直显示 `xxx is typing`。
    - 入站分发异常时主动 `stopTyping`，避免异常路径残留 typing。
  - Telegram 同步接入相同 class 控制器，避免同类问题在其他渠道重复出现。
  - 执行 config-meta：在 `AGENTS.md` 的 Rulebook 固化 class 方案偏好（现规则名为 `class-over-function-sprawl`），明确默认偏好 class 方案并禁止同职责逻辑长期平铺为一排函数。

## 测试 / 验证 / 验收方式

### 构建与静态验证

```bash
pnpm build
pnpm lint
pnpm tsc
```

结果：通过（仅保留既有 max-lines 类 warning，无新增 error）。

### 冒烟验证（隔离目录）

```bash
TMP_HOME=$(mktemp -d /tmp/nextclaw-typing-class-align.XXXXXX)
NEXTCLAW_HOME="$TMP_HOME" node packages/nextclaw/dist/cli/index.js channels status
NEXTCLAW_HOME="$TMP_HOME" node packages/nextclaw/dist/cli/index.js plugins list --enabled
rm -rf "$TMP_HOME"
```

验收点：
- 9 个渠道插件仍正常加载（无回归）。
- 运行时改动未破坏渠道插件注册链路。

### 重点行为验收（代码级）

- Discord typing 由 class 控制器统一驱动，具备自动超时回收：
  - `start()` 后会定时发送 typing 心跳；超过 `autoStopMs` 自动停止。
  - `send()` 与异常路径都会触发 `stop()`，避免悬挂。
- Telegram 使用同一控制器机制，行为一致。

## 发布 / 部署方式

本次变更涉及渠道运行时包，不涉及后端数据库。

建议发布顺序：

```bash
pnpm release:version
pnpm release:publish
```

建议发布组件：
- `@nextclaw/channel-runtime`
- （如版本变更传导）`@nextclaw/channel-plugin-*`
- （如依赖范围变化）`@nextclaw/openclaw-compat`

闭环说明：
- 远程 migration：不适用（无后端/数据库变更）。
- 服务部署：不适用（npm 包变更）。
- 线上 API 冒烟：不适用（无后端 API 发布）。
