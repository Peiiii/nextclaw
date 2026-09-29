# NextClaw Harness

`@nextclaw/harness` 是嵌入 NextClaw Agent 运行能力的公共入口；宿主通过平台合同提供资源。

它只承载公共 API 与类型边界；任务、session、事件和生命周期语义由 NextClaw kernel 的同一条主链路实现。

## 安装

```bash
pnpm add @nextclaw/harness @nextclaw/kernel
```

## 一次性任务

使用完整本地产品的工具、技能、扩展与上下文：

```ts
import { runNextclawTask } from "@nextclaw/harness";

const result = await runNextclawTask({ input: "检查工作区，并整理待办" }, {
  homeDir: "/path/to/nextclaw",
});
```

Node 根入口还提供 `createNextclawApplication(options)`，返回 `{ harness, kernel }`：它只 prepare 资源与完整产品管理入口，调用方连接服务后再 `harness.start()`，最终由 `harness.dispose()` 统一释放。扩展加载由服务入口管理；一次性 `runNextclawTask` 已包含加载。

直接使用平台与 Harness 则可组合自定义工具目录：

```ts
import { NextclawHarness } from "@nextclaw/harness";
import { NodePlatform } from "@nextclaw/kernel";

const harness = new NextclawHarness({ platform: new NodePlatform() });
try {
  await harness.start();
  const result = await harness.runTask({ input: "给我一份工作区整理计划" });
  console.log(result.text);
} finally { await harness.dispose(); }
```

## 长生命周期 Harness

```ts
import { NextclawHarness } from "@nextclaw/harness";
import { NodePlatform } from "@nextclaw/kernel";

const harness = new NextclawHarness({ platform: new NodePlatform({ homeDir: "/path/to/nextclaw" }) });
await harness.start();

try {
  const result = await harness.runTask({ input: "继续刚才的整理计划", sessionId: "organizing" });
  console.log(result.text);
} finally {
  await harness.dispose();
}
```

## 平台扩展

`NodePlatform` 打开本地配置、模型、MCP、journal、项目与搜索资源，保留磁盘数据。它不创建 Agent 引擎；公共 Harness 创建同一个 AgentKernel，管理会话、上下文、工具调用和压缩。平台 `start()` 返回资源合同 `AgentKernelResources`，不返回 manager graph。`dispose()` 关闭句柄，不删除文件。

已配置的 MCP 工具由共享 Kernel 自动接入，并沿用 Agent 可访问性过滤。结构化结果工具也按原请求 metadata 合同自动提供。

文件、命令行和业务工具由宿主通过 Contribution 明确注册；SDK 不隐式启动完整 NextClaw 应用的后台服务。Node 文件工具可组合 Kernel 根入口的 `LocalWorkspaceStore` 与 `createWorkspaceByteTools`。完整本地产品的原工具装配不由这段 SDK 示例替代。

```ts
const harness = new NextclawHarness({
  platform: new NodePlatform({ sessionSearchEnabled: false, sessionTitleEnabled: false }),
  allowSlashCommands: false,
});
```

扩展通过 `Contribution` 使用受限的 `this.kernel` façade。首批可组合能力包括 `tools`、`context`、`models`、`runtimes` 和 `mcp`；它们都随 Harness 自动启动和逆序释放。

```ts
import { Contribution, NextclawHarness } from "@nextclaw/harness";
import { NodePlatform } from "@nextclaw/kernel";

class BusinessContribution extends Contribution {
  constructor() {
    super({ id: "acme.business" });
  }

  protected setup = (): void => {
    this.effect(() =>
      this.kernel.context.register({
        provide: () => ["Business context"],
      }),
    );
  };
}

const harness = new NextclawHarness({ platform: new NodePlatform() });
harness.contributions.register(new BusinessContribution());
```

当前 API 为 experimental。完整合同、错误分类和 CLI 用法见 NextClaw 文档站的“开发者”模块。
