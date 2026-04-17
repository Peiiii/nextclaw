# Builtin Runtime Package Relocation Plan

**Goal:** 把误放在 `packages/extensions/` 下的内建 runtime 执行层包与 Hermes HTTP bridge 包移回 `packages/` 顶层，纠正“非插件实现层被误读成插件”的目录主语问题。  
**Scope:** 仅搬迁以下三个包，不扩展到真正的 plugin 包：

- `@nextclaw/nextclaw-ncp-runtime-http-client`
- `@nextclaw/nextclaw-ncp-runtime-stdio-client`
- `@nextclaw/nextclaw-ncp-runtime-adapter-hermes-http`

## Why

当前这三个包都不再通过 plugin 机制注册，也不承担外部扩展入口职责。继续放在 `packages/extensions/` 下，会持续制造错误心智：看起来像插件，实际上是内建 runtime engine 或内建 bridge。

## Target

搬迁后目录应为：

- `packages/nextclaw-ncp-runtime-http-client`
- `packages/nextclaw-ncp-runtime-stdio-client`
- `packages/nextclaw-ncp-runtime-adapter-hermes-http`

包名保持不变，外部 import specifier 不变，避免引入发布名或运行时行为变更。

## Required updates

1. 物理移动目录
2. 修正根脚本中的路径
3. 修正包内 `prepublishOnly` 相对脚本路径
4. 刷新 lockfile
5. 更新本批次迭代 README
6. 跑最小验证

## Non-goals

- 不搬真正的 runtime plugin 包
- 不改 package name
- 不改 runtime 主链行为
