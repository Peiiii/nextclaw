# Feature Root 与目录边界

只在需要判断单一 feature root、`features/`、`shared/`、`contributions/`、平台层或跨包入口时读取本文件。命名、文件角色或目录概况应返回入口选择对应 reference。

## 核心模型

`feature` 是语义作用域，不是强制目录名。仓库、app/package、feature 和子 feature 都按同一顺序判断：

1. 当前作用域有几个稳定并列业务域？
2. 当前目录能否直接作为唯一 feature root？
3. 新层级是否降低真实导航和变更成本？

默认采用能保持清晰的最小结构：

- `L1 Minimal Package`：单一主能力，不建空的 `features/shared/platforms`。
- `L2 Single-Platform Multi-Feature`：两个及以上稳定并列业务域，使用 `app + features + shared（按需）`。
- `L3 Frontend Multi-Platform`：平台差异已成为长期一等边界，再增加 `platforms`。

`monorepo` 是仓库级分区，不是 `L` 等级。每个 app/package 仍独立选择自己的内部模型。

## Scope Root

任何显式 scope root 默认只保留边界文件和允许的职责目录：

- 边界文件：`index.ts(x)`、少量启动或装配入口。
- 通用职责目录：`components/configs/hooks/presenters/stores/managers/services/pages/types/utils/providers/controllers/repositories/routes`，只按需出现。
- 角色实现不得散落在 root；`*.service.ts`、`*.store.ts`、`*.utils.ts` 等回到对应职责目录。
- 前端展示作用域需要真实的 presenter/manager/store owner，但不要求机械补齐空目录。
- Electron 等混合运行时应把 renderer 与 main 壳层放在独立 root，分别遵守自己的合同。

## 何时展开

### 保持单根

只有一个主业务能力、改动仍高度内聚、拆分收益只是“看起来整齐”时，当前目录就是 feature root，不增加 `features/`。

### 引入 `features/`

仅在出现两个及以上可稳定命名、通常独立变化的并列业务域时引入。子 feature 同样必须拥有独立状态、编排或用户表面；技术文件分组不算子 feature。

父级 `components/` 只放 shell、layout、跨子 feature 组合或轻量展示。拥有容器、测试和独立上下文选择的用户入口应进入自己的子 feature。

### 引入 `shared/`

内容必须被两个及以上 sibling scope 真实复用、合同稳定且不属于某一 feature 私有逻辑。禁止把 `shared/` 当作业务域、第二套 features 或暂存区。

`shared/` 一级目录只使用通用职责目录；`lib/` 是特殊模块容器：

- `shared/components|configs|hooks|types` 文件直放，不增加 barrel。
- `shared/lib/` 根下只放模块目录；每个 `lib/<module>/index.ts(x)` 是唯一出口，禁止 deep import。
- 同一共享能力只能有一个稳定导入地址。
- `common/misc/helpers/support/temp/modules/integrations` 等弱语义兜底目录默认禁止。

### 引入 `contributions/`

只用于 kernel/runtime 装配作用域的旁路能力：它监听已有事实、投影或写回已有 owner，但不拥有主链路。普通业务 feature 和 UI feature 不使用该角色。

- kernel 只管理 contribution 生命周期，不理解其内部业务。
- contribution 构造器优先接收 kernel owner，不从外部拆传 manager/event bus 等稳定协作者。
- `contributions/<name>/index.ts` 是唯一公开入口，内部按角色进入 `services/utils/types` 等目录。
- contribution 不成为其它模块的公共实现来源；必要的子 contribution 继续使用同一唯一入口规则。

## 平台、CLI 与 Package

### `platforms/`

仅在同一前端长期承载多个真实平台，且差异不能由少量适配器解决时使用。

- `features/` 仍是业务主轴；`platforms/` 只承载平台 API、桥接、provider wiring 和适配。
- `platforms/<platform>/` 根下只放通用职责目录，并由 `index.ts(x)` 提供唯一出口。
- 禁止按平台复制整套 feature；共享业务先收敛，平台差异才下沉。

### CLI

CLI 是独立 app/package 形态，不是 L3 平台。简单 CLI 保持 L1；多个稳定命令域时使用 `app + commands + shared（按需）`，其中 `commands/` 是主业务聚合层。

### Package 与 Monorepo

只有独立发布、真实跨 app 复用、强运行时/所有权边界或依赖隔离收益成立时才拆 package。不要把 package 当作 feature root 混乱的逃生门。

Monorepo 只决定 `apps/packages/workers/tooling` 等仓库边界；包内部仍按 L1-L3 判断。

## 导入边界

- 同目录使用 `./`；已声明 package alias 的作用域跨目录使用该唯一 alias，禁止父级相对路径穿透。
- 可被其它 workspace 以源码方式消费的 package 禁止通用 `@/` alias；使用相对路径或包级唯一 alias。
- workspace 之间只导入对方 package 根入口或 `package.json exports`，禁止 deep import `src/shared/commands` 等内部路径。
- 不得在消费者 `tsconfig` 增加窄 alias 来掩盖被依赖包的入口或 alias 错误。

## 决策与输出

依次说明：

1. 当前是仓库、app/package、feature 还是子 feature。
2. 包内采用 L1/L2/L3，或为什么这是 monorepo 边界问题。
3. 稳定并列业务域数量，以及更简单结构为什么够或不够。
4. 目标目录、唯一公共入口、local/shared/platform 的归属。
5. 是否存在白名单外目录或跨包 deep import；若有，给出迁移路径。
6. 本次 planned paths 和 `pnpm preflight:governance -- <paths...>` 结果。

## 禁止项

- 单一业务强套 `features/`，或多个业务继续散落根目录。
- 用技术层分组伪造 feature/subfeature。
- 用 `shared/`、`utils/`、`types/` 吸收私有业务逻辑。
- 为少量 UI 差异复制平台 feature。
- 在 scope root 平铺角色文件、制造无意义 barrel 或白名单外弱语义目录。
- 用 package、alias、wrapper 或新层级掩盖 owner 判断错误。
