---
"nextclaw": minor
"@nextclaw/kernel": minor
"@nextclaw/server": patch
"@nextclaw/ui": patch
---

将 WASM Service App 的共享执行器切换为嵌入式 Spin Runtime Factors，同时保持现有 `.napp`、WIT、Service Action 与 runner 协议不变。

新增外部依赖就绪状态：默认 App 仍为自包含并可直接启用；显式声明额外 capability 或 resource 的 App 会在 API、CLI 和界面中显示缺失要求，并在依赖未满足时阻止误启用。
