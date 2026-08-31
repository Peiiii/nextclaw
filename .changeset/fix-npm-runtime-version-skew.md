---
"nextclaw": patch
"@nextclaw/service": patch
---

修复 NPM launcher 更新后继续运行旧 runtime bundle 的问题。launcher 版本高于当前 bundle 时，会先通过已配置的更新通道获取匹配 runtime，避免新包与旧执行代码混用。
