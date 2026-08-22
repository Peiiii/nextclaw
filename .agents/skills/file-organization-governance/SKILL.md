---
name: file-organization-governance
description: 当新增、重命名、移动文件，改变文件角色/feature root/目录边界，或用户明确要求命名、文件组织和目录概况治理时使用；统一路由命名、角色、feature-root 和概况扫描，局部修改现有文件不触发。
---

# 文件组织治理

## 入口判断

先选择一个当前模式，不批量读取全部参考：

- 新增/重命名/移动文件、角色后缀或 kebab-case：读取 [命名合同](references/naming.md)；完整规格仅在规则歧义时再读 [命名规格](references/file-naming-spec.md)。
- 判断 service/store/utils/config/types、假角色或 barrel：读取 [文件角色](references/file-roles.md)。
- 判断单 feature root、features、shared、contributions、跨包公共入口：读取 [Feature Root](references/feature-root.md)。
- 用户只要目录热点、问题量化和治理优先级：读取 [目录概况](references/overview.md)，不直接重构。

同一决策只读取一个模式；只有前一模式明确暴露另一个独立问题时才继续。

## 共同规则

- 先角色、再领域、再层级；没有真实复杂度不展开模板目录。
- 文件名表达主要职责，目录和后缀一致；禁止 `common/misc/general` 等模糊垃圾桶。
- 角色冲突检查只提出问题，不预设修复方向：必须同时评估“增强实现以成为真实角色 owner”和“按现状改名/移动”两个候选，比较职责收益、状态与生命周期封装、复用与测试价值、调用方成本和新增抽象负担；禁止默认选择改动最小的一边。
- 一个 feature root 内优先内聚；只有稳定跨 feature 复用才进入 shared。
- 跨 workspace 依赖只走公共入口或 exports，不用消费者 alias 绕过边界。
- 新增、重命名、移动或角色边界变化前运行 `pnpm preflight:governance -- <planned-paths...>`。
- 局部修改现有文件不重复运行 planned-path preflight，也不加载本 skill。

## 自动检查

现有目录扫描与重构脚本位于 `scripts/`。脚本结果是结构事实信号，不替代 role/feature owner 判断，也不能决定是升级实现还是修正命名；自动改写前先确认范围且不得触碰无关 WIP。

## 输出

说明当前模式、目标路径、角色/feature 判断、preflight 结果和明确不改的范围。不要同时复述四份 reference。
