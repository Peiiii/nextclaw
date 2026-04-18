---
name: collapsible-feature-root-architecture
description: 用于定义或重构基于 feature 的代码组织架构，尤其适用于判断当前作用域应保持单 feature root、何时引入 features/ 聚合层、何时拆稳定子 feature、何时严格限制 shared 目录，以及如何分别处理包内部结构与仓库级组织边界。
---

# 可折叠 Feature-Root 架构

## 概述

采用一种按复杂度渐进展开的 feature-first 组织方式，而不是默认铺满整套目录模板。

这里要先明确一个前提：

- `L` 系列只描述包内部或应用内部的结构模型
- `monorepo` 不是 `L` 级别之一，而是一套独立的仓库级组织规范
- 两者是正交关系，可以组合，但不应混成同一条复杂度轴

核心原则：

- `feature` 是一个语义单元，不是强制目录名。
- 如果当前作用域只有一个主 feature，那么当前目录本身就是这个 feature root。
- 只有当前作用域下出现多个并列 feature，才引入 `features/` 作为聚合层。
- 只有某个 feature 内部出现多个稳定子业务域，才继续引入下一层 `features/`。

这样做的目标是：

- 低复杂度项目保持最小结构
- 高复杂度项目沿同一套规则自然生长
- 不让目录模板本身变成新的复杂度来源

## 作用域模型

同一套判断规则可递归应用在每一层作用域：

- 仓库
- 应用 / package
- feature
- 子 feature

每一层都先回答同一个问题：

1. 当前作用域里有几个稳定的并列业务域？
2. 当前目录是否可以直接作为一个 feature root？
3. 是否真的需要显式增加一层 `features/`？

## 包内通用规则

在进入 `L0`、`L1`、`L2`、`L3` 之前，要先明确一件事：

- 通用职责目录白名单
- `shared/` 的准入条件
- `shared/` 的内部结构规则
- feature 的唯一导出入口
- 平台差异层的唯一导出入口
- 目录白名单与弱语义目录禁止规则

这些都不是只属于某一个等级的局部规则。

它们默认是包内部结构的通用规则，适用于 `L0`、`L1`、`L2`、`L3`；区别只在于：

- 某个等级是否真的需要用到某个目录
- 某个等级是否已经出现对应的结构轴
- 某些规则在低等级场景下可能暂时“不启用”，而不是“不成立”

因此不要把 `L3` 理解成“只有到了前端多平台才开始有这些规则”。

更准确地说：

- `L0`、`L1`、`L2`、`L3` 共用同一套包内治理原则
- `L3` 只是这些规则在前端多平台场景下的最完整展开形态
- 前面的等级更像是 `L3` 的子集或裁剪态，而不是另一套独立规范

## 包内复杂度分级

### `L0`：单 feature root

适用条件：

- 当前应用、模块或 package 只有一个明确主 feature
- 如果额外加一层 `features/`，只是在制造空壳目录

推荐结构：

```text
src/
├── app/         # 仅应用根可用
├── services/
├── managers/
├── repositories/
├── controllers/
├── types/
└── shared/      # 可选
```

这里不要再额外创建 `features/`。  
当前根目录本身就是 feature root。  
注意：这只是示意结构，不代表所有目录都必须出现。

### `L1`：多个并列 feature

适用条件：

- 当前作用域下已经存在两个及以上稳定业务域
- 继续把它们并排放在根目录，会让边界开始模糊

推荐结构：

```text
src/
├── app/
├── features/
│   ├── auth/
│   ├── notes/
│   └── settings/
└── shared/
```

### `L2`：feature 内部存在稳定子 feature

适用条件：

- 某个 feature 已经大到包含多个长期存在的子业务域
- 父 feature 根目录开始成为热点目录
- 拆分后能降低导航成本，而不是只增加目录层级

推荐结构：

```text
src/
├── app/
├── features/
│   └── notes/
│       ├── services/
│       ├── managers/
│       ├── repositories/
│       ├── controllers/
│       ├── types/
│       └── features/
│           ├── message-timeline/
│           ├── thread-management/
│           └── onboarding/
└── shared/
```

### `L3`：前端多平台

适用条件：

- 同一个前端 app 或 package 需要同时承载多个真实平台
- 平台差异已经大到不能只靠少量适配器解决
- 这些差异是长期存在的，而不是短期实现细节

推荐结构：

```text
src/
├── app/
├── features/
│   ├── chat/
│   ├── auth/
│   └── settings/
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

这里要明确：

- `features/` 是主业务轴，业务能力优先放在这里
- `shared/` 是稳定共享层，只容纳通用职责抽象，不容纳业务域目录
- `platforms/` 是平台差异层，不是第二套 `features/`
- 默认应先共享业务实现，只有平台专属适配、桥接、provider wiring 与平台 API 接入才进入 `platforms/`
- `platforms/<platform>/` 根下应只出现通用职责目录，不应出现业务目录名
- `L3` 不是新增一套专属规则，而是把包内通用规则与平台差异规则同时展开的全集场景

只有当前端平台差异已经成为稳定的一等边界时，才进入 `L3`。  
不要因为少量 UI 差异或单个入口函数不同，就过早升级到 `L3`。

## 展开规则

### 什么时候保持“当前目录就是一个 feature root”

当以下条件大体成立时，应保持当前作用域为一个 feature root，不额外增加 `features/`：

- 只有一个主业务能力
- 从当前根目录出发仍然容易导航
- 大多数改动仍然集中发生在同一业务域内
- 如果拆目录，收益主要只是“看起来更整齐”，而不是真正降低维护成本

### 什么时候引入 `features/`

只有满足以下任一信号时，才应在当前作用域引入 `features/`：

- 已经出现两个及以上稳定并列业务域
- 这些业务域可以被清晰命名，而不是临时切分
- 变更通常只触及其中一个域，而不是总是成组修改
- 根目录开始混入互不相干的业务代码

### 什么时候引入子 feature

只有满足以下条件时，才应在某个 feature 内继续引入下一层 `features/`：

- 父 feature 内已经形成多个稳定子业务域
- 每个子域都有自己的一组状态、编排、页面或组件面
- 继续把所有内容堆在父 feature 根目录，会明显增加导航与修改成本

如果只是把文件按技术层重新分组，而没有形成新的业务边界，就不要称之为子 feature。

### 什么时候允许 `shared/`

`shared/` 是可选目录，而且默认应当偏少。

只有同时满足以下条件，文件才允许进入 `shared/`：

- 被两个及以上 sibling scope 真实复用
- 契约稳定
- 不属于某个 feature 的私有业务逻辑
- 不是因为“暂时不知道放哪”才被丢进去

如果某段代码只服务于一个 feature，就应留在该 feature root 内部。

### `shared/` 的固定语义

`shared/` 不是第二套 feature 根，也不是“暂时不知道放哪”的回收站。

`shared/` 只承载稳定共享层，放进去的内容必须满足两个前提：

- 它的共享关系是真实存在的，而不是预判式抽取
- 它表达的是通用职责抽象，而不是具体业务域

因此，`shared/` 的一级目录必须优先使用通用职责目录名，而不是业务目录名。

### 通用职责目录总白名单

通用职责目录不是可以临时发明的，它们应来自一份固定总白名单。

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

这里要明确：

- 这份总白名单描述的是“职责角色”，不是“当前 scope 必须全部拥有”
- 各作用域只能从这份总白名单里按需选择适用项
- `shared/lib/` 不属于这份普通职责白名单，它是特殊目录

### `shared/` 一级目录规则

在前端 `L3` 场景下，`shared/` 的一级目录应使用：

- 特殊目录：`lib/`
- 以及通用职责目录总白名单中的任意适用项

这里要明确：

- `shared/` 下允许的是“非 feature 的通用职责类目录”
- `features/` 不允许出现在 `shared/` 下
- 业务目录名不允许出现在 `shared/` 下
- 渠道名、平台名、集成面目录也不允许出现在 `shared/` 下

例如以下目录名不应作为 `shared/` 一级目录出现：

- `transport/`
- `marketplace/`
- `auth/`
- `remote-access/`
- `desktop/`
- `web/`

如果某个目录名本身已经在表达业务域、平台域或集成域，就说明它不属于 `shared/` 的稳定抽象层。

### `shared/components`、`shared/hooks`、`shared/types`

这三类目录采用“文件直放、无 barrel”的规则：

- 允许直接放文件
- 不要求为了单文件额外包一层目录
- 根下禁止新增 `index.ts` 或 `index.tsx`
- 对外导入时直接导入文件本身

示例：

```text
shared/
├── components/
│   └── button.tsx
├── hooks/
│   └── use-copy.ts
└── types/
    └── pagination.types.ts
```

允许：

```ts
import { Button } from "@/shared/components/button";
import { useCopy } from "@/shared/hooks/use-copy";
import type { Pagination } from "@/shared/types/pagination.types";
```

禁止：

```ts
import { Button } from "@/shared/components";
import { useCopy } from "@/shared/hooks";
import type { Pagination } from "@/shared/types";
```

### `shared/lib`

`shared/lib/` 是 `shared/` 下面的特殊目录，它不是“再放一些 utils”的兜底层，而是“模拟独立包”的强边界模块层。

规则如下：

- `shared/lib/` 根下禁止直接放文件
- `shared/lib/` 根下只允许子目录
- `shared/lib/` 根下禁止新增 `index.ts` 或 `index.tsx`
- 每个子目录都视为一个模拟独立包的小模块
- 每个子目录必须有 `index.ts` 或 `index.tsx`
- 该 `index.ts(x)` 是该模块唯一公共出口
- 禁止 deep import 到模块内部文件
- `shared/lib/` 下的 sibling 模块之间也不得直接引用对方内部文件

推荐示例：

```text
shared/
└── lib/
    ├── date-format/
    │   ├── index.ts
    │   └── date-format.utils.ts
    └── project-root/
        ├── index.ts
        └── project-root.utils.ts
```

允许：

```ts
import { formatDate } from "@/shared/lib/date-format";
```

禁止：

```ts
import { formatDate } from "@/shared/lib/date-format/date-format.utils";
import { formatDate } from "@/shared/lib/date-format/index";
```

### `shared/` 的唯一导入地址原则

`shared/` 的目标不是“目录长得整齐”，而是强制稳定的唯一导入地址。

具体来说：

- `shared/components`、`shared/hooks`、`shared/types` 采用“文件即入口”
- `shared/lib/*` 采用“目录即入口”
- 不应让同一共享模块同时暴露多个平行导入地址

如果一个共享能力同时支持：

- 从目录根导入
- 从目录内文件导入
- 从某个额外 barrel 导入

那么它的边界就是不稳定的，这违反 `shared/` 的治理目标。

## 白名单规则

### 总规则

- 每一层作用域都应先使用一份“允许目录白名单”来约束结构。
- 白名单内目录全部都是“按需可选”，不要求补齐。
- 白名单外目录默认禁止，不允许随手新增弱语义目录。
- 如果必须突破白名单，必须同时说明：
  - 为什么现有白名单承载不了
  - 为什么这不是命名漂移或职责逃逸
  - 长期归宿或退出条件是什么

不要把“按需创建”理解成“可以任意发明新目录”。

### 应用根白名单

应用根或 package 根允许出现以下目录，全部按需可选：

- `app/`：启动、路由、装配、依赖注入、provider wiring、server/bootstrap
- `features/`：当前作用域存在多个并列 feature 时使用
- `shared/`：当前作用域存在真实共享内容时使用
- `platforms/`：仅当前作用域需要前端多平台差异时使用
- 其余职责目录只能从固定通用职责目录总白名单中按需选择，不允许临时发明新角色目录

如果当前作用域已经明确采用 `L3`，则应用根应进一步收敛为固定骨架：

- `app/`
- `features/`
- `shared/`
- `platforms/`

此时默认不再允许把 `hooks/`、`services/`、`stores/`、`utils/` 等通用职责目录直接平铺在应用根。

### 前端 Feature Root 白名单

前端 feature root 允许出现以下目录，全部按需可选：

- `features/`：当前 feature 存在多个稳定子 feature 时使用
- 固定通用职责目录总白名单中的任意适用项
- `shared/`：仅在当前 feature 的多个子 feature 之间存在真实共享时使用

前端 feature root 默认不应自行再放 `app/`。

### 后端 Feature Root 白名单

后端 feature root 允许出现以下目录，全部按需可选：

- `features/`：当前 feature 存在多个稳定子 feature 时使用
- 固定通用职责目录总白名单中的任意适用项
- `shared/`：仅在当前 feature 的多个子 feature 之间存在真实共享时使用

后端 feature root 默认不应出现 `components/`、`hooks/`、`pages/`、`stores/` 这类明显前端运行时导向的目录，除非该作用域本身就是前端运行时或同构渲染层。

### 禁止目录示例

以下目录名默认禁止作为白名单外兜底目录出现：

- `common/`
- `misc/`
- `helpers/`
- `support/`
- `temp/`
- `modules/`
- `lib/`
- `integrations/`
- `workers/`
- `consumers/`

除非它们在当前作用域被明确定义为白名单目录，且职责边界被清楚写明。

## 命名规则

- 目录名统一使用 `kebab-case`
- feature 与子 feature 名称必须体现业务域，而不是技术层名字
- 通用源码默认使用显式角色后缀：
  - `.manager.ts`
  - `.service.ts`
  - `.repository.ts`
  - `.controller.ts`
  - `.types.ts`
  - `.utils.ts`
- 前端特有命名：
  - `.store.ts`
  - hook 文件使用 `use-<domain>.ts` 或 `use-<domain>.tsx`
  - 页面入口文件使用 `<domain>-page.tsx`
- 后端常见命名：
  - `.route.ts`
  - `.provider.ts`
- `index.ts` 仅用于导出聚合，不承载业务逻辑

若本次工作涉及仓库级命名治理或重命名，请配合使用 [file-naming-convention](../file-naming-convention/SKILL.md)。

## 边界规则

- 一个作用域应尽量只有一种主组织模型
- 不要在同一业务域里长期混用 `feature-first`、根目录散落式组织、宽泛 layer-first
- 不要新建白名单外的弱语义兜底目录
- 不要把某个 feature 的私有编排逻辑塞进 `shared/`
- 如果新结构替代旧结构，必须立刻定义旧结构的退役路径

## 平台、Package 与 Monorepo 规则

### 平台拆分

只有在前端平台约束确实不同的情况下，才引入 `platforms/`。

前端常见平台：

- `desktop/`
- `pwa/`
- `web/`

不要因为页面长得不完全一样，就立刻镜像整个 feature。

推荐做法：

- `features/` 统一承载业务域，`platforms/` 只承载平台差异
- 每个平台目录根下只放固定通用职责目录总白名单中的目录，例如 `providers/`、`services/`、`stores/`、`utils/`
- 每个平台目录根必须有 `index.ts` 或 `index.tsx`，作为平台差异层的唯一出口
- 外部禁止 deep import 平台目录内部文件
- 共享业务 feature 逻辑应优先收敛，而不是为每个平台复制一份再慢慢漂移
- 平台特有的适配器、壳层、桥接与平台 API 接入留在对应平台作用域

### CLI

`CLI` 不是 `L3`。

它不是前端多平台里的一个平台目录，而是一种独立的 app / package 形态。

如果某个 package 是 CLI，推荐把它当成一个独立应用根来组织：

```text
src/
├── app/
├── features/
├── shared/
├── services/
├── types/
└── utils/
```

这里要明确：

- CLI 入口统一放在 `app/`
- 参数解析、命令装配、命令分发都属于 `app/` 的职责
- 不要为了 CLI 再额外长出 `commands/` 目录
- 真正的业务能力仍应落回 `features/`

如果 CLI 很简单，也可以不建 `features/`，直接按 `L0` 处理，让当前根目录就是单 feature root。

### Package

`package` 不是一种单独的结构模型。

它只是一个结构承载单元，内部仍然继续使用 `L0`、`L1`、`L2` 或 `L3`。

判断规则是：

- 如果 package 只有一个主能力，就按 `L0`
- 如果 package 内有多个并列业务域，就按 `L1`
- 如果 package 内某个 feature 再长出多个稳定子域，就按 `L2`
- 如果 package 本身是前端多平台应用，才按 `L3`

### Package 拆分

只有满足以下任一条件时，才应新建 package：

- 需要独立发布
- 跨 app 复用已经真实存在且稳定
- 运行时边界或所有权边界很强
- 为了隔离依赖，package 成本是值得的

不要把 package 当作 feature root 混乱后的逃生门。

### Monorepo

`monorepo` 不是包内部结构等级，不应被编号为 `L3`。

它是仓库级组织规范，负责回答的是：

- 仓库里是否存在 `apps/`、`packages/`、`tooling/` 这类一等边界
- 哪些能力应该拆成独立 package
- 哪些边界需要独立发布、独立依赖、独立运行时或独立 ownership

典型结构：

```text
apps/
packages/
tooling/
docs/
```

这里要明确：

- `monorepo` 决定的是“仓库怎么分区”
- `L0`、`L1`、`L2`、`L3` 决定的是“单个 app / package 内部怎么组织”
- 即使仓库采用 monorepo，每个 app / package 内部仍然继续独立选择自己的包内结构模型
- 不要把仓库级拆分和包内 feature 分层揉成一套编号体系

## 决策流程

在决定目录结构前，按顺序回答：

1. 当前讨论的是哪一层作用域：仓库、app、feature，还是 subfeature？
2. 如果当前是仓库层，讨论的是 monorepo 边界，还是某个 app / package 的内部结构？
3. 当前作用域里有几个稳定并列业务域？
4. 如果答案是 1，当前目录能否直接作为 feature root？
5. 如果答案是 2 个及以上，是否应该引入 `features/` 作为聚合层？
6. 候选 `shared/` 内容是否真的被多个 sibling scope 复用？
7. 本次拆分是业务边界拆分，还是只是技术文件重排？
8. 当前目录是否仍在白名单内？
9. 是否存在一个更小、更简单但仍然可预测的结构？

始终选择“能保持清晰的最小结构”。

## 输出要求

当使用本 skill 时，输出中必须包含：

- 当前讨论的是仓库级 monorepo 规范，还是包内部结构规范
- 若为包内部结构，当前选择的复杂度等级：`L0`、`L1`、`L2` 或 `L3`
- 当前作用域的推荐目标结构
- 为什么更简单的结构不够，或为什么更大的结构没必要
- 当前作用域使用的是哪一份目录白名单
- 是否存在白名单外目录；若存在，为什么例外成立
- 什么应留在本地 scope，什么才允许进入 `shared/`
- 适用的命名规则
- 若为重构场景，本次推荐的迁移顺序

## 反模式

- 明明只有一个主 feature，却仍然强行套一层 `features/`
- 明明已经有多个并列业务域，却还把它们散落在根目录平铺
- 在没有稳定业务边界时，过早把内容拆成子 feature
- 把临时实现块、局部 UI 分组误升格为子 feature
- 让 `shared/`、`utils/`、`types/`、`common/` 吸纳私有业务逻辑
- 用“按需创建”为理由不断新增白名单外目录
- 把应用根目录 `app/` 下沉到普通 feature root
- 多平台项目中无差别镜像所有 feature 目录
- 还没形成稳定边界，就过早拆 package

## 推荐搭配

- 当需要扫描混乱目录并识别潜在拆分点时，配合使用 [file-organization-governance](../file-organization-governance/SKILL.md)
- 当需要统一命名、角色后缀和重命名策略时，配合使用 [file-naming-convention](../file-naming-convention/SKILL.md)
