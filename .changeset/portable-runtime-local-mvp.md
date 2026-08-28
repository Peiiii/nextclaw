---
"@nextclaw/app-runtime": minor
"@nextclaw/kernel": minor
"@nextclaw/server": minor
"@nextclaw/client-sdk": minor
"@nextclaw/ui": minor
"@nextclaw/service": minor
"nextclaw": minor
---

新增 Rust-first Portable Runtime 产品基础：NextClaw 现在可以从产品资源启动共享 Wasmtime runner，在现有 App Package、Panel App 与 Service Action 体系内运行 Rust/WASM Component，不需要手工配置开发者 runner 路径。

内置「日常小工具箱」提供今日清单、灵感便签、专注小钟和联系人整理四个真实场景，覆盖持久数据、Resident 后台事件、Provider/Consumer 组合、Panel 授权与 Agent Tool 复用。runner 超时或异常退出后会按依赖顺序恢复持久组件，并保留宿主管理的数据。

应用安装失败时会清理新建的不可变版本目录，避免发布者或实例校验失败阻塞后续合法安装。`nextclaw app check/dev/call` 已复用同一 Runtime 支持 Portable Service，构建合同和 CI 覆盖 macOS arm64、Linux x64 与 Windows x64，并保留 macOS x64、Linux arm64 目标映射；平台 runner 资源使用原子替换，热构建不会覆盖正在执行的二进制。Secret、Blob、长任务、流式能力和生产级资源隔离仍在整体产品计划中保持为未关闭项。
