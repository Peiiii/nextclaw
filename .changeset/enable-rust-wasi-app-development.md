---
"nextclaw": minor
"@nextclaw/app-runtime": minor
"@nextclaw/kernel": patch
"@nextclaw/server": patch
---

补齐 Rust WASI Component App 的创建、诊断、构建、校验、测试、调试、打包、安装与运行闭环，并为组件失败提供稳定错误码和运行观测信息。

同时使 NPM 安装在受支持的 Node.js 20 与 22+ 环境中都能直接使用 SQLite：Node.js 20 自动使用随包提供的 WASM SQLite 实现，无需本机编译原生依赖。
