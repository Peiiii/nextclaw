# NCP Agent Runtime Source

This directory contains the default NCP agent runtime, context conversion,
stream encoding, tool registry, asset handling, and package export surface.

## 目录预算豁免

- 原因: 当前目录是 `@nextclaw/ncp-agent-runtime` 的 package root source surface，保留少量 root files 作为稳定 package 边界可以避免把 public exports、runtime assembly、tool registry、stream encoder 与测试支撑拆成过深目录。本次新增 `tool-result-content.manager.ts` 是为了在 runtime 边界统一治理工具结果内容项与模型上下文预算，后续若继续增长，应优先把 `agent-runtime.service.ts`、stream encoder、context builder、asset store 按 `services/`、`utils/` 或 `stores/` 拆分。
