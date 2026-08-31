---
"@nextclaw/app-runtime": patch
"@nextclaw/kernel": patch
"@nextclaw/server": patch
"@nextclaw/client-sdk": patch
"@nextclaw/ui": patch
"nextclaw": patch
---

为 WASI 应用补齐用户目录授权闭环。用户现在可以在应用页面或 CLI 中查看声明的目录权限，选择运行主机上的文件夹，以只读或读写方式授权，并随时替换或撤销；授权变化会立即淘汰旧的 Runtime 挂载。
