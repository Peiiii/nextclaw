---
name: file-organization-governance
description: 自动检测和改善代码库的文件组织结构，确保代码具有清晰的模块化和分层架构。使用模块化分割（按功能领域）和分层抽象（按职责分层）的双重策略，在每次代码修改后自动运行检测，或在目录文件数超过阈值时触发。
---

# 文件组织治理

## 概述

使用此技能自动检测和改善代码库的文件组织结构，确保代码具有清晰的模块化和分层架构。该技能采用双重组织策略：按功能领域模块化分割和按职责分层抽象。

这里要特别明确：

**“目录结构规范”不是只指这一份 skill 文本。**

对本项目而言，目录结构规范系统至少包含以下几部分：

1. **高层结构模型**
   - owner: `collapsible-feature-root-architecture`
   - 负责回答：当前作用域是 `L1`、`L2`、`L3`、还是其他明确协议；当前目录是否应保持 single feature root；何时允许 `features/`、`shared/`、`platforms/`

2. **文件角色落位规则**
   - owner: `role-first-file-organization`
   - 负责回答：文件先按什么角色建模；角色文件应落到哪个职责目录；任何 scope root 哪些文件属于边界文件，哪些不应直接挂在根下

3. **文件与目录命名规则**
   - owner: `file-naming-convention`
   - 负责回答：文件后缀、目录命名、角色后缀、`kebab-case` 等命名层约束

4. **目录治理执行入口**
   - owner: `file-organization-governance`（本 skill）
   - 负责回答：什么时候触发目录治理；如何扫描、识别、分组、提出重构动作；需要联动哪些其他结构规则

5. **可执行治理脚本**
   - owner: `scripts/governance/*`
   - 尤其包括：
     - `scripts/governance/module-structure/*`
     - `scripts/governance/lint-new-code-flat-directories.mjs`
     - `scripts/governance/lint-new-code-file-role-boundaries.mjs`
     - `scripts/governance/lint-new-code-frozen-directories.mjs`
     - `scripts/governance/lint-new-code-directory-names.mjs`
   - 负责把部分目录结构规范变成可运行的自动检查

6. **目录结构协议 / contract 数据**
   - owner: `module-structure.config.json` 与 `scripts/governance/module-structure/module-structure-contracts.mjs`
   - 负责回答：某个 package / app 当前声明采用什么结构协议、允许哪些根目录、允许哪些根文件、共享层如何建模

这里还要明确一条对应原则：

**高层目录规范、脚本协议、workspace contract 引用必须一一对应。**

- 不允许只在 `module-structure-contracts.mjs` 里新增或放宽一个 protocol，却没有同步把它对应到高层结构规范
- 不允许高层 skill 已经声明某个结构类别，但脚本层没有对应 protocol / 检查语义
- 不允许 `module-structure.config.json` 引用一个协议名，而该协议在高层规范里没有 owner、适用边界和约束说明
- 新增或修改 protocol 时，必须同时检查：
  - `collapsible-feature-root-architecture`
  - `role-first-file-organization`
  - `scripts/governance/module-structure/*`
  - 相关 `module-structure.config.json`
- 若这几层没有同步完成，就不应视为目录结构规范已经落地

这里再加一条仓库级硬规则：

**每个 workspace 根默认都必须显式声明 `module-structure.config.json`。**

- 适用范围包括 `apps/*`、`packages/*`、`packages/extensions/*`、`packages/ncp-packages/*`、`workers/*` 等实际 workspace 根
- 不允许继续依赖“因为没声明 contract，所以脚本没管到”的灰区
- 若某个 workspace 结构暂时还不适合复用现有 protocol，也必须先声明一个显式 contract（可为 legacy 或新的 protocol），而不是裸奔

因此，当用户说“调整目录结构规范”时，默认不能只改这一份 skill，而要检查：

- 结构模型 skill 是否要改
- 角色落位 skill 是否要改
- 命名 skill 是否要改
- `scripts/governance/*` 是否已有对应自动化检查
- module-structure contract / protocol 是否要同步更新
- workspace 根缺失 `module-structure.config.json` 的检查是否也要同步更新

如果最终只改了其中一层，必须明确说明为什么其他层不适用。

这里的 `scope root` 包括但不限于：

- package / app 根
- feature root
- 子 feature root
- command root
- platform root
- `shared/lib/<module>/` 这类显式模块根

默认原则统一为：

**root 保边界，角色文件回角色目录。**

对于前端展示层项目，再额外加一条强约束：

**`presenters/`、`managers/`、`stores/` 必须真实存在，不是可选建议。**

- 如果该项目属于前端 `L1` 单根作用域，它们默认应出现在该作用域根下
- 如果该项目属于前端 `L3` / 多 feature 作用域，它们可以落在 `app/`、feature root 或平台作用域内，但不能整体缺席
- 不允许只靠 `service` 或 provider 文件名去“代替” presenter / manager / store 这三个 owner

## 使用时机

在以下情况触发此技能：

- 每次代码修改后自动运行检测
- 用户主动请求代码组织审查
- 目录文件数量超过阈值（>15个文件）
- 检测到混合关注点的目录
- 当需要重构混乱的目录结构时
- 在新项目初始化或大型重构期间

## 工作流程

1. **扫描分析**：扫描目标目录的文件数量和组织结构
2. **问题识别**：识别需要重构的目录（文件过多或混合关注点）
3. **语义分组**：根据文件命名模式建议模块化分组
4. **分层建议**：对大型模块（>8个文件）建议分层架构
5. **规则对齐**：检查本次问题主要属于结构模型、角色落位、命名规则、自动化脚本还是 protocol contract
6. **脚本联动检查**：若规则变化会影响自动治理结果，检查 `scripts/governance/*` 与相关测试/contract 是否也要同步更新
7. **生成计划**：生成重构计划和迁移步骤
8. **执行重构**：在安全情况下自动执行重构

## 方法论

### 模块化分割
按功能领域将代码分割到不同的模块。以下是一些常见示例，可根据实际项目需求调整：

- service（服务相关）
- plugin（插件相关）
- config（配置相关）
- channel（通道相关）
- diagnostic（诊断相关）
- security（安全相关）
- remote（远程访问相关）
- ncp（NCP相关）
- agent（代理相关）

**注意**：以上仅为示例，实际项目应根据具体业务领域和功能进行模块划分。

### 分层抽象
在大型模块内部按职责分层。以下是一些常见示例，可根据实际项目需求调整：

- controllers/（控制器层）
- services/（服务层）
- utils/（工具层）
- types/（类型定义层）
- hooks/（钩子层）
- components/（组件层）

**注意**：以上仅为示例，实际项目应根据具体架构模式和职责进行分层。

平铺职责目录硬约束：

- `hooks/` 与 `services/`、`utils/`、`stores/` 一样，应被视为平铺职责目录；`hooks/` 下禁止再出现子目录，只允许直接 hook 文件。
- `lib/` 应被视为模块容器目录；`lib/` 下只能出现模块子目录，不能直接放文件。共享能力应先落到 `lib/<module>/`，再由该模块目录的 `index.ts` / `index.tsx` 暴露公共出口。

## 操作步骤

1. 运行检测脚本分析目录结构：
   ```bash
   node .agents/skills/file-organization-governance/scripts/enhanced-check-organization.js [目录路径]
   ```

2. 根据输出建议确定重构方案

3. 如需自动重构，使用重构脚本

## 决策规则

- 当单个目录文件数 > 15 时，触发模块化建议
- 当单个模块文件数 > 8 时，建议分层结构
- 保持模块和层的职责单一
- 优先按功能模块组织，再考虑内部分层
- 避免过度分层造成导航困难
- 根据项目实际情况灵活调整模块和分层策略
- 若目标目录是 `hooks/`，禁止用再套一层子目录来“分类”
- 若目标目录是 `lib/`，优先创建模块目录而不是直接堆文件

当请求涉及“修改目录结构规范”而不是单次目录整理时，额外执行：

1. 判断变更属于下列哪一类：
   - 结构模型变化
   - 角色落位变化
   - 命名变化
   - 自动化检查变化
   - protocol contract 变化
2. 搜索 `scripts/governance/*` 是否已有对应检查在执行这条规则
3. 若已有脚本在执行该规则，不得只改 skill 文本；必须同步修改脚本或明确说明不适用原因
4. 若结构协议会变，检查对应 `module-structure.config.json` / protocol contract 是否也应同步调整
5. 若新增/修改了 protocol，还必须检查高层 skill 是否已同步写清该协议对应的结构类别、适用场景、白名单边界与例外范围
6. 最终明确说明：本次改动更新了目录结构规范系统中的哪些部分，哪些部分未动以及原因

## 参考

- [../collapsible-feature-root-architecture/SKILL.md](../collapsible-feature-root-architecture/SKILL.md) - 高层结构模型
- [../role-first-file-organization/SKILL.md](../role-first-file-organization/SKILL.md) - 文件角色落位
- [../file-naming-convention/SKILL.md](../file-naming-convention/SKILL.md) - 命名规则
- [scripts/enhanced-check-organization.js](scripts/enhanced-check-organization.js) - 智能检测脚本
- [scripts/refactor-organization.js](scripts/refactor-organization.js) - 自动重构脚本
- [demo.md](demo.md) - 使用示例和效果展示
