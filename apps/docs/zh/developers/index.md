# NextClaw Harness SDK

NextClaw 提供两种 headless 入口。它们共享一致的任务、session、事件和运行结果语义，因此脚本、CI 和 Node.js 程序可以按场景切换入口，而不改变核心行为。

| 入口 | 适合场景 | 特点 |
| --- | --- | --- |
| [in-process Harness](./harness) | Node.js 应用、服务和长生命周期进程 | 在进程内组装 Agent、管理会话与运行，并统一释放资源 |
| [`nextclaw exec`](./exec) | Shell、CI、定时任务和管道 | 一次任务、纯净 stdout、text/JSON/JSONL 输出 |
| [平台扩展能力](./platform-capabilities) | 需要接入自有系统的 Agent 平台 | 监听事件、扩展 Ingress，并注册工具、上下文、模型、Runtime 和 MCP |

## 如何选择

- 只需要执行一次任务并读取结果：使用 `nextclaw exec` 或 `runNextclawTask()`。
- 需要在同一进程中运行多次任务、接收事件或自行管理 session：使用 Harness。
- 需要恢复会话时显式传入 `sessionId` 或 `--session`；未指定时会创建新的 `exec:<uuid>` session。

## 快速开始

CLI 已随 NextClaw 提供：

```bash
nextclaw exec "总结当前工作区"
```

Node.js 程序安装独立的 Harness 入口包：

```bash
pnpm add @nextclaw/harness
```

```ts
import { runNextclawTask } from '@nextclaw/harness';

const result = await runNextclawTask({ input: '总结当前工作区' });
console.log(result.text);
```

## Experimental 边界

当前公共 API 已覆盖 Harness 生命周期、Agent 与 session handle、live run、Kernel 原实例 event bus / ingress，以及由 Harness 托管的工具、上下文、模型、Runtime 和 MCP 扩展。App Server、structured output、approval handler、storage、sandbox、skill、channel 和 app 还没有进入 Harness 公共 API。

继续阅读：[Harness API](./harness)、[平台扩展能力](./platform-capabilities)、[`nextclaw exec`](./exec) 和[示例](./examples)。
