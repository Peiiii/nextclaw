# 日常小工具箱

这是 Portable Runtime MVP 的产品化体验包。它不要求体验者理解 WASM、Action 或 Provider，而是先提供四个普通人能直接使用的小应用；每个应用背后对应一条必须验证的运行时主链。

## 先体验产品

| 小应用 | 能做什么 | 背后验证的机制 |
| --- | --- | --- |
| 今日清单 | 添加、完成、恢复和删除今天的任务 | Rust/WASM 数据 Action、Host KV 持久化、Panel 与 Agent 共用数据 |
| 灵感便签 | 随手保存、搜索和删除便签 | 两个独立 Panel 复用同一个数据 Component |
| 专注小钟 | 开始一轮专注、记录完成点，关掉页面后仍计时 | Resident Component、宿主事件投递、持久恢复 |
| 联系人整理 | 清理姓名空格、邮箱大小写和重复标签 | Consumer 经宿主调用独立 Provider Component |

应用列表还保留一个「开发者验证台」。它不是普通用户的主入口，只用于查看共享 runner、受控网络、越权拒绝、超时恢复和运行时指标等底层证据。

## Agent 也能使用

「今日清单」和「灵感便签」使用的 Service Action 可以显式授权给 Agent。授权后，Panel 与 Agent 操作的是同一份结构化数据，权限、持久化和错误处理也走同一条主链，没有 Demo 专用旁路。

## 真实调用链

```text
日常小应用 / Agent
  → Service Action 授权
  → ServiceAppManager
  → wasi-component runtime
  → 共享 Rust/Wasmtime runner
  → Host capability / component-call
  → Rust/WASM Component
```

## 当前边界

这是单平台技术 MVP：官方 Guest 只覆盖 Rust，不承诺 Python/FastAPI 等现有框架直接编译，也不代表跨平台 runner 分发、签名、升级和生产级资源治理已经完成。
