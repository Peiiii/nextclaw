# 日常小工具箱

这是 Portable Runtime MVP 的产品化体验包。它不要求体验者理解 WASM、Action 或 Provider，而是先提供四个普通人能直接使用的小应用；每个应用背后对应一条必须验证的运行时主链。

## 先体验产品

| 小应用 | 能做什么 | 背后验证的机制 |
| --- | --- | --- |
| 今日清单 | 添加、完成、恢复和删除今天的任务 | Rust/WASM 数据 Action、Host KV 持久化、Panel 与 Agent 共用数据 |
| 灵感便签 | 随手保存、搜索和删除便签 | 两个独立 Panel 复用同一个数据 Component |
| 专注小钟 | 开始一轮专注、记录完成点，关掉页面后仍计时 | Resident Component、宿主事件投递、持久恢复 |
| 联系人整理 | 清理姓名空格、邮箱大小写和重复标签 | Consumer 经宿主调用独立 Provider Component |

运行时包还包含一个仅用于验收的标准 Spin SQLite Component：它使用 `fermyon:spin@2.0.0/sqlite` 完成建表、写入和查询；每个 App 实例的数据目录独立，重启后仍从同一私有数据库读取，未授予存储时由标准接口返回拒绝。

应用列表还保留一个「运行时验收与证据」。它不是普通用户的主入口，用来查看已安装实例真实产生的 PRT 验收记录、最近环境、运行时间和脱敏证据。没有记录的项目会显示“未验证”，不会把静态说明当成通过；当前尚未注册检查器的项目会标明“等待对应检查器”。

## Agent 也能使用

「今日清单」和「灵感便签」使用的 Service Action 可以显式授权给 Agent。授权后，Panel 与 Agent 操作的是同一份结构化数据，权限、持久化和错误处理也走同一条主链，没有 Demo 专用旁路。

## 真实调用链

```text
日常小应用 / Agent
  → Service Action 授权
  → ServiceAppManager
  → wasi-component runtime
  → 共享 Rust/Spin runner（底层使用 Wasmtime）
  → Host capability / component-call
  → Rust/WASM Component
```

## 当前边界

官方 Guest 开发链路目前以 Rust 为主，不承诺 Python/FastAPI 等现有框架可以直接编译成 Component。具体能力是否完成、在哪个平台通过，以「运行时验收与证据」中当前安装实例的编号记录为准；没有当前证据就不会显示为通过。
