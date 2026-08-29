# Portable Runtime

Portable Runtime 是 NextClaw 执行 WASM Service App 的运行方式。应用把业务逻辑编译成平台无关的 WebAssembly Component，NextClaw 通过共享的原生 Wasmtime runner 装载和执行它，并向 Component 提供一组受控的宿主能力。

它解决的是 Service App 的运行与能力边界，不是一套新的应用产品：App 安装、Panel、Service Actions、用户授权和数据生命周期仍由 NextClaw 原有体系管理。

> Portable Runtime 当前处于实验阶段。官方 Guest 开发路径只覆盖 Rust，且尚不能把它视为运行不受信任代码的生产级安全沙箱。

## 什么时候使用

Portable Runtime 适合需要以下特征的 Service App：

- 希望同一份业务 Component 在多个桌面平台使用；
- 希望多个轻量服务共享一个原生运行器，而不是每个服务常驻一个 JavaScript 进程；
- 需要宿主管理的持久 KV、受控网络请求或 Component 组合；
- 需要按调用运行、持续接收事件或向其它 Component 提供能力；
- 希望 Panel、Agent 和 CLI 复用同一套 Service Action 合同。

已有 MCP Service 不需要为了使用 NextClaw 而改写。`mcp` 和 `wasi-component` 是 Service App 的两种并列协议。

## 运行链路

```text
Panel App ─┐
Agent ─────┼─→ Service Action / grant ─→ NextClaw Kernel ─→ shared runner ─→ WASM Component
CLI ───────┘                                      │
                                                   └─→ KV / HTTP GET / declared Provider
```

NextClaw Kernel 是产品语义的 owner：它解析 App 和 Service 清单、检查调用者授权、确定数据目录与能力范围，并管理运行时状态。runner 只负责 Component 装载、WIT linking 和执行。

## 三种运行角色

| 角色 | 生命周期 | 适合场景 |
| --- | --- | --- |
| Action | 收到调用时执行；不需要长期保留实例 | 查询、写入、计算、转换、受控请求 |
| Resident | 保留同一个实例，并按清单间隔接收宿主事件 | 计时、轮询、需要跨 Panel 保持内存状态的工作 |
| Provider | 保留独立实例，供显式声明依赖的 Component 调用 | 可复用的规范化、查询或领域能力 |

三种角色都实现同一个 `service-app` world。区别来自 `service-app.json` 的 `lifecycle` 声明，而不是三套不同框架。

## 当前宿主能力

WIT 合同 `nextclaw:portable-service@0.1.0` 当前提供：

- 分级日志；
- 宿主管理的 KV 读取与写入；
- 受 `allowedDomains` 限制的 HTTPS GET；
- 调用已声明 Provider 的 `component-call`；
- runner 进程、已加载 Component 数量和当前 Component id 等运行信息。

Component 不会自动继承宿主文件系统或原生网络。存储、网络和 Provider 依赖都由所属 schema v2 App 的清单限定。

## 共享 runner 与恢复

NextClaw 通过一个共享子进程执行多个 Component：

- Action 按需装载和调用；
- Resident 与 Provider 在 runner 中保留实例；
- Provider 会先于依赖它的持久角色启动；
- runner 异常退出或调用超时时，Kernel 结束故障进程，并重建需要持续存在的 Provider 和 Resident；
- 失败中的调用不会被自动重放。

当前超时恢复用于闭合故障主链路，不等同于完整的进程内资源隔离。内部 CPU、内存和并发限制仍需要继续完善。

## 跨平台模型

WASM Component 是平台无关产物；原生 runner 由 NextClaw 针对目标操作系统提供。当前源码包含 macOS arm64/x64、Linux x64 和 Windows x64 的资源映射。

通过 NPM 安装时，稳定 launcher 会在首次启动时检查当前平台的完整 Runtime。runner 缺失时，它会下载并验证签名 Runtime，再从完整版本启动；如果暂时无法联网但本机已有完整 Runtime，则继续使用该版本，不需要手工复制 runner。

正式发布会在 macOS arm64、Linux x64 和 Windows x64 上分别完成构建，并走一遍真实的 HTTP 启用、五个 Component 发现、Provider/Resident 启动和 Action 调用。Linux x64 runner 使用静态链接，不会继承构建机器的 glibc 版本要求。

## 当前边界

- 官方 Guest 开发路径目前只覆盖 Rust；不能直接把 FastAPI 或现有 Python 依赖树整体编译成当前 Component。
- 公开合同尚不包含 Secret、文件与 Blob、流式 HTTP、长任务进度与取消，也不包含 Component 直接调用模型或 Agent。
- Resident 当前接收宿主定时事件，还没有通用外部事件订阅路由。
- Provider 不支持递归调用另一个 Provider。
- 当前不是用于运行不受信任代码的生产级安全沙箱。

## 接下来

- [Runtime 模型与能力合同](/zh/developers/portable-runtime-contracts)
- [开发 WASM Service App](/zh/developers/portable-service-apps)
- [Service Apps](/zh/guide/service-apps)
