# 平台扩展能力

Harness Contribution 可以向 Agent 运行环境添加资源，无需导入 Kernel manager。请在 `harness.start()` 前注册 Contribution；Harness 会按顺序启动 effect，并在关闭时逆序释放。

```ts
import {
  Contribution,
  NextclawHarness,
  createTypedKey,
  eventKeys,
} from '@nextclaw/harness';

const customerLookupIngress = createTypedKey<{ id: string }>(
  'acme.customer.lookup',
);

class BusinessContribution extends Contribution {
  constructor() {
    super({ id: 'acme.business', version: '1.0.0' });
  }

  protected setup = (): void => {
    this.effect(() =>
      this.kernel.eventBus.on(eventKeys.ncpEvent, (event) => {
        observeAgentEvent(event);
      }),
    );

    this.effect(() =>
      this.kernel.ingress.addHandler(customerLookupIngress, ({ payload }) =>
        loadCustomer(String(payload?.id)),
      ),
    );

    this.effect(() =>
      this.kernel.tools.register({
        name: 'lookup_customer',
        parameters: { type: 'object', properties: { id: { type: 'string' } } },
        execute: async ({ id }) => loadCustomer(String(id)),
      }),
    );

    this.effect(() =>
      this.kernel.context.register({
        provide: async (request) => [await loadBusinessContext(request.agentId)],
      }),
    );
  };
}

const harness = new NextclawHarness();
harness.contributions.register(new BusinessContribution());
await harness.start();
```

## 可用命名空间

| 命名空间 | 可以完成的操作 |
| --- | --- |
| `kernel.eventBus` | 使用 `eventKeys` 监听或发送 Kernel 公共事件 |
| `kernel.ingress` | 使用 `ingressKeys` 调用标准入口，或用 typed key 注册扩展入口 |
| `kernel.tools` | 注册供 Agent 运行使用的 `NcpTool` |
| `kernel.context` | 按每次请求添加上下文块 |
| `kernel.models` | 注册模型提供方、列出提供方，并调用 chat 或 streaming chat |
| `kernel.runtimes` | 注册 NCP Runtime Provider，以及 Agent 可选择的 Runtime Entry |
| `kernel.mcp` | 注册由 Harness 托管的 MCP Server，列出 Server 与工具，并调用工具 |

`kernel.eventBus` 与 `kernel.ingress` 是 Harness 所属 Kernel 的原实例，不是 SDK 复制的事件桥或路由表。`EventBus.on()` 与 `Ingress.addHandler()` 都返回 disposer，放进 `this.effect()` 后会随 Contribution 自动释放。

模型提供方只注册到当前 Harness 所拥有的 Kernel。MCP Server 以进程内 overlay 形式存在：它仍使用标准 MCP 连接生命周期，但不会写入用户配置文件。

每个注册方法都会返回 disposer。请从 `this.effect()` 返回 disposer；effect 支持异步 setup，包括 `kernel.mcp.registerServer()`。Contribution 不需要重写 `start()` 或 `dispose()`，`setup()` 也不接收 context 参数。

`skills`、`storage`、`sandboxes`、`channels` 和 `apps` 目前还不是 Harness 公共命名空间。
