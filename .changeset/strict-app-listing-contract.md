---
"nextclaw": patch
"@nextclaw/app-runtime": patch
"@nextclaw/core": patch
---

完善社区 App 的运行与公开上架合同：schema v2 Service App 必须如实声明为宿主原生进程并进入高权限人工审核，审核通过后可以公开上架；本地与市场服务端都会拒绝用 `wasi` 标签伪装沙箱。管理后台同步提供“通过并公开”和“通过但不公开”，并展示后端统一判定的运行方式、组件、权限与公开资格。
