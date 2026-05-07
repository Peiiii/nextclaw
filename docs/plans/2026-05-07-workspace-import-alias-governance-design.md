# Workspace Import Alias Governance Design

日期：2026-05-07

## 1. 结论

NextClaw workspace 的 import alias 采用三档策略：

```text
App / 最终入口包：允许继续使用 @/*
简单 library 包：优先使用相对路径
复杂核心 library 包：经过登记后，才允许使用短包级唯一 alias
```

这不是为了统一而统一，而是为了避免“一个包的内部 alias 被另一个包错误解析”的问题，同时保留日常开发效率。

核心判断：

- `@/*` 的语义是“当前应用的 src root”，适合 app，不适合会被其它包源码消费的 library。
- 跨包公开引用永远走 package name，例如 `@nextclaw/kernel`。
- 包内 alias 如果确实需要，必须全仓唯一、短、登记过，并且只允许该包内部使用。
- 简单 library 不强制 alias。能用清楚的相对路径，就不要造别名。

## 2. 背景

这次 `@nextclaw/kernel` 被多个包通过源码 path 消费后，暴露出一个路径解析问题：

```json
{
  "paths": {
    "@nextclaw/kernel": ["../nextclaw-kernel/src/index.ts"]
  }
}
```

当 consumer 包直接编译 `nextclaw-kernel/src/index.ts` 时，kernel 内部如果继续写：

```ts
import type { UpdateSnapshot } from "@/types/update.types.js";
```

`@/*` 很可能按 consumer 自己的 tsconfig 解析，而不是按 kernel 的 tsconfig 解析。于是 `@/types/...` 会被解释成 consumer 的 `src/types/...`，而不是 kernel 的 `src/types/...`。

临时把这些 import 改成相对路径能让编译通过，但这不是好设计：它绕开了问题，没有建立清晰的 workspace alias 规则。

## 3. 对标判断

大型 monorepo 的常见做法不是让 consumer 随意理解另一个包的内部 alias，而是保持 package boundary：

- 跨包引用走 package name 与 package `exports`。
- 构建/发布消费 dist 或正式 package 入口。
- 开发态可以有源码加速，但要保证内部 alias 归属不被 consumer 抢走。

TypeScript 的 `paths` 只影响类型解析，不会改变 emit，也不是 library 的运行时契约。因此，不能把 `paths` 当成跨包公开 API。

Node 的 `package.json#imports` 是标准机制，但本仓库不把它作为第一步方案。原因是 `#...` 对团队阅读习惯和工具链一致性有额外成本；当前更合适的折中是短包级唯一 alias。

## 4. 三档规则

### 4.1 App / 最终入口包

允许使用 `@/*`。

适用对象：

- `packages/nextclaw-ui`
- `apps/desktop`
- `apps/platform-console`
- `apps/platform-admin`
- worker / web app 等最终入口包

原因：

- `@/*` 在 app 中含义清晰：当前应用的 `src` root。
- app 通常不是被其它包作为源码 library 消费的对象。
- UI / app 文件较多，保留 `@/*` 对开发效率有价值。

### 4.2 简单 Library 包

默认使用相对路径。

适用条件：

- 目录结构浅；
- 文件数量少；
- 跨目录引用少；
- 没有频繁 `../../../`；
- 不是多个包共同源码消费的基础设施核心。

推荐写法：

```ts
import type { Foo } from "../types/foo.types.js";
```

不推荐为了“看起来统一”强行引入：

```ts
import type { Foo } from "@some-long-package-name/types/foo.types.js";
```

简单 library 的好代码应当更少机制、更少配置、更少心智负担。

### 4.3 复杂核心 Library 包

只有满足条件并登记后，才允许使用短包级唯一 alias。

适用条件：

- 会被多个 workspace 包源码消费；
- 是长期基础设施或核心边界；
- 内部目录层次较深；
- 相对路径已经明显降低可读性；
- package owner 愿意维护 alias 映射和治理规则。

候选 alias：

```text
@kernel/*
@core/*
@server/*
@client-sdk/*
```

命名原则：

- 短，避免 `@nextclaw-very-long-package-name/*`。
- 全仓唯一，不能两个包都叫同一个 alias。
- 能表达 package owner，不表达任意目录。
- 只允许包内使用，不是跨包公开 API。

## 5. 禁止与允许

允许：

```ts
// app 内部
import { Button } from "@/shared/components/ui/button";

// 简单 library 内部
import type { Foo } from "../types/foo.types.js";

// kernel 内部，登记后
import type { UpdateSnapshot } from "@kernel/types/update.types.js";

// 跨包公开引用
import { nextclaw, eventKeys } from "@nextclaw/kernel";
```

禁止：

```ts
// library 内部继续使用共享 @/*
import type { UpdateSnapshot } from "@/types/update.types.js";

// 跨包引用别人的内部 alias
import { EventBus } from "@kernel/events/event-bus.service.js";

// 跨包引用别人的 src 内部路径
import { EventBus } from "@nextclaw/kernel/src/events/event-bus.service.js";
```

## 6. Consumer tsconfig 规则

开发态可以为了速度让 consumer 直接消费 workspace package 源码：

```json
{
  "paths": {
    "@nextclaw/kernel": ["../nextclaw-kernel/src/index.ts"]
  }
}
```

但如果该 package 内部使用登记过的短 alias，consumer 也必须只为编译识别补映射：

```json
{
  "paths": {
    "@nextclaw/kernel": ["../nextclaw-kernel/src/index.ts"],
    "@kernel/*": ["../nextclaw-kernel/src/*"]
  }
}
```

这条映射不代表 consumer 可以业务 import `@kernel/*`。它只是为了 TypeScript 在编译被消费源码时能正确解析 package 内部 alias。

## 7. 当前试点方案

第一步只处理 `@nextclaw/kernel`。

原因：

- 它是基础 library。
- 它会被 `nextclaw-server`、`nextclaw-client-sdk`、`nextclaw-ui`、`nextclaw` 等多个包源码消费。
- 当前问题正是由 kernel 内部 alias 归属不清导致。
- 它的内部结构已经足够稳定，适合登记短 alias。

拟登记：

```text
packages/nextclaw-kernel -> @kernel/*
```

改动范围：

- `packages/nextclaw-kernel/tsconfig.json`
- `packages/nextclaw-kernel/src/**/*.ts`
- 消费 kernel 源码的 workspace 包 tsconfig
- 必要的 Vite / Vitest / tsdown alias 配置

不做：

- 不全仓批量改 alias。
- 不把所有 library 都改成包级 alias。
- 不引入 `#imports` 作为本轮方案。
- 不允许其它包直接使用 `@kernel/*` 作为业务 import。

## 8. 验证要求

试点必须至少通过：

```bash
pnpm --filter @nextclaw/kernel test
pnpm --filter @nextclaw/kernel tsc
pnpm --filter @nextclaw/kernel build
pnpm --filter @nextclaw/client-sdk tsc
pnpm --filter @nextclaw/server tsc
pnpm --filter @nextclaw/ui tsc
pnpm --filter @nextclaw/ui build
pnpm --filter nextclaw tsc
pnpm --filter nextclaw build
pnpm lint:maintainability:guard
```

还需要加一个静态检查：

```bash
rg "from ['\\\"]@/" packages/nextclaw-kernel/src
```

预期无结果。

## 9. 后续治理

后续可增加 governance：

- app 包允许 `@/*`。
- library 包默认禁止新增 `@/*`。
- 复杂核心 library 使用短 alias 前必须登记。
- consumer 包禁止业务代码 import 别人的内部 alias。
- alias registry 可以先放在 governance 配置里，待规则稳定后再沉淀为脚本。

治理目标不是制造更多规则，而是防止三个问题：

1. consumer 误解析 provider 内部 alias；
2. 跨包绕过正式 package boundary；
3. 简单包被迫引入无意义长 alias。

## 10. 推荐落地顺序

1. 以 `@nextclaw/kernel` 作为唯一试点。
2. 把 kernel 内部相对路径恢复为 `@kernel/*` 或保留少量局部相对路径。
3. 给 consumer tsconfig 补 `@kernel/*` 解析，仅用于编译识别。
4. 跑完整验证。
5. 如果试点稳定，再评估 `@nextclaw-core`、`@nextclaw-server`、`@nextclaw-client-sdk` 是否需要同类治理。

这条路线兼顾：

- app 开发效率；
- library 包边界；
- 源码消费速度；
- 长期可维护性；
- 避免过度抽象。
