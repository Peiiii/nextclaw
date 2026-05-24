---
name: role-first-file-organization
description: 用于整理 TypeScript/JavaScript 文件结构、判断文件职责角色、重命名模块、清理分层目录边界不清的问题。尤其适用于 service/store/utils/config/types 角色混乱、开始冒出假角色、习惯性添加 index.ts barrel，或把领域名误当成架构角色的场景。
---

# 角色优先文件组织

## 概述

先判断文件的角色，再判断它属于哪个领域；先删掉假层和中转层，再决定是否真的要加结构。

核心原则：

- `role` 高于 `domain`
- 优先复用已有角色
- 不要为了某个领域词发明新角色
- 文件已经自解释时，不要保留无意义 `index.ts`

## 使用时机

在以下情况使用本 skill：

- 需要整理 `TypeScript / JavaScript` 文件结构
- 需要判断某个文件到底该算 `service`、`store`、`utils`、`config` 还是 `types`
- 目录里开始出现 `contracts`、`schemas`、`readers` 这类语义可疑的新角色
- 模块看起来被拆得太碎，路径读不出职责
- 团队习惯性加 `index.ts` barrel，但 barrel 本身不提供真实边界
- 文件名里领域词很多，但角色语义越来越看不出来

## 工作流程

1. 先给每个文件写出一个最高层角色词。
2. 优先从已有角色里选：`service`、`store`、`utils`、`config`、`types`。
3. 只有当现有角色体系真的表达不了时，才考虑新角色。
4. 在新增结构前，先删除空层、假抽象、无意义 `index.ts` 和多余目录。
5. 最终检查路径和文件名是否已经能直接说明职责。

## 角色判断顺序

### `service`

用于以下职责：

- 有状态编排
- 业务流程串联
- 生命周期协调
- 远程 IO 协调
- 多步行为的拥有者

强制补充：

- `.service.ts` 文件内部必须声明 `class`
- 如果只有纯函数、纯映射、解析、归一化、装配或导出聚合，即使语义上服务于某个领域，也不能命名为 `.service.ts`
- classless 模块应按真实职责落到 `utils`、`manager`、`controller`、`config` 或其它既有角色
- 禁止为了满足 `.service.ts` / role-boundary 检查，给 classless 模块硬加没有真实状态、生命周期或流程所有权的 class；正确做法是改文件角色/命名，或抽出真实 owner

### `store`

用于以下职责：

- 本地持久状态
- 路径或布局所有权
- 读写状态适配
- pointer / state 文件访问
- 存储驱动的状态切换

### `utils`

用于以下职责：

- 无状态校验
- 解析
- 归一化
- 比较
- 转换

补充原则：

- `utils` 不要求“全局通用”或“跨很多模块复用”
- 只要它是无状态逻辑，并且不拥有流程或状态，就可以是 `utils`
- 即使当前只被一个 feature 使用，也不妨碍它属于 `utils`

### `tools`
仅用于 agent-facing tool 定义或 tool 组合；文件命名使用 `*.tools.ts`，一个文件可以放一个或多个同领域 agent tool。`tools/` 不是通用工具函数目录，纯函数/解析/归一化仍归 `utils`，状态、生命周期或业务流程回到 manager / service / store。
### `config`

仅用于以下职责：

- 真正的配置对象
- 配置访问入口

注意：

- 读取外部数据不等于 `config`
- 解析 manifest、归一化输入、做字段校验，这些通常不该伪装成 `config`

### `types`

仅用于以下职责：

- 纯类型定义
- 不包含可执行逻辑的结构声明

## 核心规则

- `role` 是高于 `domain` 的抽象层级
  - `bundle-manifest` 是领域名
  - `utils`、`service` 是角色名
- 任何 `scope root` 原则上只保留边界文件；角色实现文件应落到对应角色目录
- 不要因为领域有特殊名词，就发明一个新角色
- 不要把“读取外部文件”误判成 `config`
- 不要把纯解析/归一化逻辑误判成 `service`
- 文件已经是清晰独立出口时，不要保留只做转发的 `index.ts`
- 角色迁移后，不要留下空目录
- 一个文件只应有一个主角色

这里要特别明确：

- 这里的 `scope root` 不只指 package 根，也包括 feature root、子 feature root、command root、platform root、`shared/lib/<module>/` 这类显式模块根
- kernel contribution root 也是 `scope root`：`contributions/<name>/index.ts` 是该 contribution 的唯一公开入口，contribution class 可直接放在这个 `index.ts`，内部角色文件进入对应角色子目录；需要隔离局部分支能力时，可以使用 `contributions/<name>/contributions/<child>/index.ts` 嵌套 contribution root
- `index.ts`、极少数 public boundary 文件，可以留在对应 scope root
- `foo.service.ts`、`bar.store.ts`、`baz.utils.ts` 这类角色实现文件，不应直接挂在任何 scope root
- 如果某个词只是架构抽象名而不是稳定角色名，不应仅因为它重要，就直接长成顶层目录角色
- 先判断它的真实角色，再决定它属于 `services/`、`stores/`、`utils/`、`config/`、`types/` 中哪一个

## 新角色门槛

只有同时满足以下条件，才允许新增角色：

- 现有角色会让文件命名产生明显误导
- 新角色表达的是可复用的架构类别，而不是某个一次性领域词
- 新角色未来会在多个模块里复用，而不是只服务一个目录
- 新角色带来的清晰度提升，大于新增词汇负担

只要其中一条不成立，就不要新增角色。

## Barrel 规则

只有在 `index.ts` 提供真实边界时才保留，例如：

- package 公共出口
- 面向消费者的明确聚合面
- 用来隐藏内部文件布局的稳定边界
- kernel contribution 的唯一公开出口；此时应只导出 contribution class，不导出内部 utils/types

以下情况应直接删除：

- 只是小模块内部转发
- 每个文件本身已经是清晰出口
- 保留它只会增加一层中转

## 重构检查清单

1. 列出涉及的文件。
2. 给每个文件写一个角色词。
3. 让文件后缀和真实职责一致。
4. 收掉假的中间层、假的抽象文件、假的角色目录。
5. 删除空目录和无意义 `index.ts`。
6. 跑最小相关验证。

## 常见错误

### 领域优先命名

- 错误：因为主题特殊，就发明一个新目录或新角色
- 更好：把领域放在 basename，把角色放在后缀或目录层级

### scope root 挂角色文件

- 错误：在某个 scope root 直接放 `*.service.ts`、`*.store.ts`、`*.utils.ts`
- 更好：scope root 保留边界文件，角色实现进入对应职责目录

### 假 `config`

- 错误：把 parser / normalizer 命名成 `*.config.ts`
- 更好：除非它真的拥有配置职责，否则放到 `utils`

### 假 `service`

- 错误：把纯解析 helper 命名成 `*.service.ts`
- 更好：编排归 `service`，无状态解析归 `utils`

### 假 owner class

- 错误：为了让 `*.service.ts` 通过检查，新增只包一层 helper、只转调另一个 manager/service、没有真实状态或生命周期的 class
- 更好：先承认该文件不是 `service`，改成 `*.utils.ts`；只有当新 class 真正拥有流程、状态、生命周期或远程 IO 协调时，才保留 `service`

### 假“特殊角色”

- 错误：为了某个领域额外发明 `contracts`、`schemas`、`readers`
- 更好：如果本质只是无状态解析，就把领域留在文件名里，角色落到 `utils`

### 习惯性 barrel

- 错误：每次重构都顺手留一个 `index.ts`
- 更好：除非它真的是边界，否则直接删

### 半套清理

- 错误：文件改名了，但旧目录、旧中转层、空目录还在
- 更好：在同一次改动里把旧结构一起删掉

## 输出要求

使用本 skill 时，结果里至少要说明：

- 每个文件或每组文件最终采用了什么角色
- 明确排除了哪些角色，以及为什么排除
- 哪些 `index.ts` 被删除了，哪些被刻意保留了
- 为了让结构更简单，本次具体删掉了什么
