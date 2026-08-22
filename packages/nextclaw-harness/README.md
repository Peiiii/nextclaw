# NextClaw Harness

`@nextclaw/harness` 是在 Node.js 应用中嵌入 NextClaw Agent 运行能力的轻量入口包。

它只承载公共 API 与类型边界；任务、session、事件和生命周期语义由 NextClaw kernel 的同一条主链路实现。

## 安装

```bash
pnpm add @nextclaw/harness
```

## 一次性任务

```ts
import { runNextclawTask } from "@nextclaw/harness";

const result = await runNextclawTask({
  input: "总结当前工作区",
});

console.log(result.text);
```

## 长生命周期 Harness

```ts
import { NextclawHarness } from "@nextclaw/harness";

const harness = new NextclawHarness();
await harness.start();

try {
  const result = await harness.runTask({ input: "检查工作区状态" });
  console.log(result.text);
} finally {
  await harness.dispose();
}
```

## 平台扩展

扩展通过 `Contribution` 使用受限的 `this.kernel` façade。首批可组合能力包括 `tools`、`context`、`models`、`runtimes` 和 `mcp`；它们都随 Harness 自动启动和逆序释放。

```ts
import { Contribution, NextclawHarness } from "@nextclaw/harness";

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

const harness = new NextclawHarness();
harness.contributions.register(new BusinessContribution());
```

当前 API 为 experimental。完整合同、错误分类和 CLI 用法见 NextClaw 文档站的“开发者”模块。
