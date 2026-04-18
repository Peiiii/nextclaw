# Module Structure Contracts

## 设计原则

这套治理的目标，不是把目录做成“看起来整齐的模板工程”，而是让代码结构满足三个长期要求：

- 业务边界清晰：业务代码优先按业务域归位，而不是先按技术角色打散
- 通用抽象稳定：真正共享的能力有固定归宿，不再依赖“大家约定俗成”
- 导入入口唯一：每个稳定模块尽量只有一个公共导入地址，避免内部结构外溢

目录结构治理本质上是在回答三个问题：

- 这段代码是业务域的一部分，还是通用职责的一部分
- 它是当前 scope 私有，还是跨 sibling scope 稳定共享
- 它暴露给外部的公共入口到底是哪一个

如果这三个问题回答不清，目录就会失控；如果这三个问题被写成固定 contract，结构治理才真正落地。

## 目录命名三分类

这套规则把源码目录名分成三类：

### 1. 业务目录名

按业务域命名，用来表达产品能力边界。

示例：

- `chat/`
- `auth/`
- `marketplace/`
- `config/`
- `remote-access/`

这类目录名只应出现在业务聚合层，例如 `features/` 下，或某个 feature 的子 feature 层。

### 2. 通用职责目录名

与具体业务无关，表达的是通用抽象角色，而不是产品域。

固定总白名单如下：

- `components/`
- `hooks/`
- `presenters/`
- `stores/`
- `managers/`
- `services/`
- `pages/`
- `types/`
- `utils/`
- `providers/`
- `controllers/`
- `repositories/`
- `routes/`

这类目录名不代表某个业务域，只代表“这一组东西的职责类型是什么”。

### 3. 全局唯一骨架目录名

这类目录不是业务，也不是普通职责层，而是整个结构的骨架目录。

固定示例：

- `app/`
- `features/`
- `shared/`
- `platforms/`

特殊说明：

- `shared/lib/` 不属于普通通用职责目录白名单，它是特殊目录，承载“模拟独立包”的强语义模块边界，应按特殊规则治理

## L4 的定位

`L4` 不是“每个平台各自复制一套完整 feature 架构”。

`L4` 的真实含义是：

- 这是一个前端多平台应用或 package
- 主业务轴固定在 `features/`
- 稳定共享层固定在 `shared/`
- 平台差异层固定在 `platforms/`
- 默认优先共享业务实现，只把平台差异放进 `platforms/`

也就是说，`L4` 的重点不是“平台优先”，而是“业务优先，平台差异后置且集中化”。

## L4 标准结构

推荐结构如下：

```text
src/
├── app/
├── features/
│   ├── chat/
│   ├── config/
│   ├── marketplace/
│   ├── auth/
│   ├── remote-access/
│   ├── agents/
│   └── doc-browser/
├── shared/
│   ├── components/
│   ├── hooks/
│   ├── lib/
│   └── types/
└── platforms/
    ├── desktop/
    ├── pwa/
    └── web/
```

这个结构表达的是：

- `app/` 负责应用装配、入口、路由、provider wiring 与启动级职责
- `features/` 负责主业务能力
- `shared/` 负责跨 feature 或跨 platform 的稳定共享抽象
- `platforms/` 负责平台差异实现，而不是主业务实现

## L4 根级约束

在 `L4` 下，应用根只允许出现固定骨架目录：

- `app/`
- `features/`
- `shared/`
- `platforms/`

默认禁止在 `src/` 根下继续新增：

- 业务目录名
- 普通通用职责目录名
- 零散根级源码文件

例如下面都不应直接出现在 `src/` 根下：

- `chat/`
- `components/`
- `hooks/`
- `managers/`
- `services/`
- `utils/`
- `providers/`

因为一旦允许这些目录直接平铺在根下，`L4` 的骨架层次就会被打穿。

## 目标

目录层级治理不再只靠 review 记忆或 README 口头说明，而是把“这个模块允许怎样长”写成一份机器可读 contract，并接入 `pnpm lint:new-code:governance`。

当前 contract 数据源位于：

- [`scripts/governance/module-structure/module-structure-contracts.mjs`](/Users/peiwang/Projects/nextbot/scripts/governance/module-structure/module-structure-contracts.mjs)

当前 diff-only 检查入口位于：

- [`scripts/governance/module-structure/lint-new-code-module-structure.mjs`](/Users/peiwang/Projects/nextbot/scripts/governance/module-structure/lint-new-code-module-structure.mjs)

## 这条治理现在会拦什么

- 约定为“root 已冻结”的模块继续新增根级文件
- 模块根目录下新增白名单之外的一级子目录
- `shared/utils/types/lib/common/helpers/support` 这类共享容器里继续长出 `service/manager/controller/provider/router/store` 这类编排型文件
- 平台应用根目录继续新增白名单之外的根级源码文件

## contract 最少要写什么

每条 contract 至少应明确：

- `modulePath`：模块根路径
- `organizationModel`：当前模块采用的组织模型
- `rootPolicy`：
  - `contract-only`：根级只允许显式白名单文件
  - `legacy-frozen`：历史根级文件暂时允许被触达，但禁止再新增新的根级文件
- `allowedRootDirectories`：模块根下允许出现的一级目录
- `allowedRootFiles`：模块根下允许继续保留或新增的根级源码文件
- `sharedDirectories`：在该模块里被视为共享容器、需要做“纯度检查”的目录

## 何时新增或修改 contract

- 某个热点目录已经被认定需要固定目录边界
- 某个模块已经进入“根目录不能再继续长”的阶段
- 某个应用根或 feature root 已经形成稳定白名单
- 你准备新增一级子目录，但现有 contract 还没声明它

默认不要先建目录再补 contract，而是先改 contract，再让新结构落地。

## 何时允许 shared 容器

只有在下面条件成立时，才应把文件放进 `shared/utils/types/lib/common/helpers/support` 这类目录：

- 它确实服务两个及以上 sibling scope
- 它不是业务编排 owner
- 它没有偷带 I/O、副作用、流程控制或状态拥有权
- 把它放进 shared 后，边界会更清晰，而不是更模糊

如果一个文件明显是 `service/manager/controller/provider/router/store` 之类 owner 逻辑，就不该继续塞进 shared 容器。

## Shared 二级规范

当某个作用域允许存在 `shared/` 时，`shared/` 的一级目录必须是固定的通用职责目录，而不是业务名或集成面。

`shared/` 的定位是“稳定共享层”，不是“第二套 feature 根”，也不是“暂时不知道放哪”的回收站。

在 `L4` 下，`shared/` 一级目录允许的是固定的通用职责类目录。常见白名单如下：

- `ui/`
- `hooks/`
- `lib/`
- `types/`
- `providers/`
- `stores/`
- `services/`
- `utils/`

其中：

- `lib/` 是特殊目录，必须遵守“目录即包、唯一出口”的强约束
- 其它一级目录都是通用职责目录，不表达业务域
- 所有目录都按需可选，不要求补齐
- `features/` 不允许出现在 `shared/` 下

以下目录名不应作为 `shared/` 一级目录出现：

- `transport/`
- `marketplace/`
- `auth/`
- `remote-access/`
- 任何其它业务名、渠道名、平台名或集成面目录

`shared/` 的一级目录承担的是稳定共享抽象层，而不是具体业务域。

如果某段代码本质上仍然属于某个 feature 的私有业务逻辑，即使它恰好写成了 `service`、`store` 或 `provider`，也不应因为目录名像通用职责，就被提升进 `shared/`。

### `shared/ui/`

- 允许直接放文件
- 禁止为了单文件先包一层无意义目录
- 禁止在 `shared/ui/` 根下新增 `index.ts` 或 `index.tsx`
- 只承载真正跨 feature 或跨平台复用的纯展示组件、展示壳或稳定 UI primitive

### `shared/hooks/`

- 允许直接放文件
- 禁止为了单文件先包一层无意义目录
- 禁止在 `shared/hooks/` 根下新增 `index.ts` 或 `index.tsx`
- hook 文件继续遵循 `use-<domain>.ts` 或 `use-<domain>.tsx`
- 只承载真正共享且边界稳定的 hook，不承载 feature 私有业务编排

### `shared/types/`

- 允许直接放文件
- 禁止为了单文件先包一层无意义目录
- 禁止在 `shared/types/` 根下新增 `index.ts` 或 `index.tsx`
- 只承载稳定共享类型契约

### `shared/lib/`

- `shared/lib/` 根下禁止直接放文件
- `shared/lib/` 根下只允许子目录
- 禁止在 `shared/lib/` 根下新增 `index.ts` 或 `index.tsx`
- `shared/lib/` 下的每个子目录都视为一个模拟独立包的小模块
- 每个子目录必须包含 `index.ts` 或 `index.tsx`，作为该模块唯一公共暴露口
- 外部只能从该子目录根导入，不允许 deep import 到模块内部文件
- `shared/lib/` 下的 sibling 模块之间同样不得 deep import 对方内部文件，也只能通过对方目录根导入

推荐示例：

```text
shared/
├── ui/
│   ├── button.tsx
│   └── notice-card.tsx
├── hooks/
│   └── use-copy.ts
├── types/
│   └── pagination.types.ts
└── lib/
    ├── date-format/
    │   ├── index.ts
    │   └── date-format.utils.ts
    └── project-root/
        ├── index.ts
        └── project-root.utils.ts
```

反例：

```text
shared/
├── transport/
├── ui/
│   └── index.ts
├── hooks/
│   └── index.ts
├── lib/
│   ├── index.ts
│   └── date-format.utils.ts
└── types/
    └── index.ts
```

## Shared 的唯一导入地址规则

这套规则的目标不是“目录长得整齐”，而是强制稳定的唯一导入地址。

- `shared/ui`、`shared/hooks`、`shared/types` 采用“文件直放、无 barrel”规则
- `shared/lib/*` 采用“目录即包、`index.ts(x)` 唯一出口、禁止 deep import”规则
- 任何共享模块都不应同时暴露多个平行导入入口

允许：

```ts
import { formatDate } from "@/shared/lib/date-format";
import { Button } from "@/shared/ui/button";
import { useCopy } from "@/shared/hooks/use-copy";
import type { Pagination } from "@/shared/types/pagination.types";
```

禁止：

```ts
import { formatDate } from "@/shared/lib/date-format/date-format.utils";
import { formatDate } from "@/shared/lib/date-format/index";
import { Button } from "@/shared/ui";
import { useCopy } from "@/shared/hooks";
import type { Pagination } from "@/shared/types";
```

## Feature 边界规则

`features/` 是业务域聚合层，因此它的一级目录只能是业务目录名。

允许：

```text
features/
├── chat/
├── auth/
└── marketplace/
```

禁止：

```text
features/
├── hooks/
├── services/
└── utils/
```

每个 feature 根都必须满足以下规则：

- 必须有 `index.ts` 或 `index.tsx`
- 该 `index.ts(x)` 是这个 feature 对外的唯一公共导入出口
- 外部禁止绕过 `index.ts(x)` 直接导入 feature 内部文件
- feature 内部允许继续按通用职责目录组织，如 `ui/`、`hooks/`、`services/`、`stores/`、`types/`、`utils/`

推荐示例：

```text
features/
└── chat/
    ├── index.ts
    ├── ui/
    ├── hooks/
    ├── services/
    ├── stores/
    └── types/
```

允许：

```ts
import { ChatPanel } from "@/features/chat";
```

禁止：

```ts
import { ChatPanel } from "@/features/chat/ui/chat-panel";
import { useChatStore } from "@/features/chat/stores/chat.store";
```

## Platforms 边界规则

`platforms/` 是平台差异层，因此它的一级目录只能是平台目录名。

常见示例：

- `desktop/`
- `pwa/`
- `web/`

每个 platform 根都必须满足以下规则：

- 必须有 `index.ts` 或 `index.tsx`
- 该 `index.ts(x)` 是该平台差异层的唯一公共导出入口
- platform 根下只能放通用职责目录
- platform 根下禁止直接放业务目录名
- 外部禁止绕过 platform 根的 `index.ts(x)` 直接导入内部文件

推荐示例：

```text
platforms/
└── desktop/
    ├── index.ts
    ├── providers/
    ├── services/
    ├── stores/
    └── utils/
```

允许：

```ts
import { desktopRuntimeProvider } from "@/platforms/desktop";
```

禁止：

```ts
import { desktopRuntimeProvider } from "@/platforms/desktop/providers/runtime.provider";
import { desktopChatBridge } from "@/platforms/desktop/chat";
```

这里要特别明确：

- `platforms/` 不是第二个 `features/`
- `platforms/` 只承载平台差异实现
- 默认共享的业务实现仍然放在 `features/`
- 只有平台专属适配、桥接、平台 API 接入、平台 provider wiring 等内容，才应该进入 `platforms/`

## 和 topology 的关系

`module-structure` 负责 diff-only 的目录层级漂移阻断。  
`topology` 继续负责全仓导入拓扑与跨层耦合报告。

目前仓库仍存在历史 topology backlog，所以 PR 流程里先把 `module-structure` 接成默认阻断，把 `topology` 作为持续可见报告；等历史拓扑债务收敛后，再决定是否把 full topology 升级为默认 blocking gate。
