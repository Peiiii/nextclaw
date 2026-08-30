# 宣传页区块布局原型目录

## 目标

把“凭感觉摆元素”改成可复用的选择问题。页面先按内容职责切成区块；每个区块根据内容角色、信息数量、顺序关系、证据数量与媒体比例，从有限原型中选择。嵌套区块递归使用同一方法，不为嵌套另造一套规则。

原型是稳定空间关系，不是固定皮肤。颜色、字体、材质和品牌语言可以变化，但内容职责、主次、对齐锚点和窄屏适配不能丢失。

## 选择流程

1. 声明区块的 `contentRole`：`orient`、`explain`、`prove`、`sequence`、`compare`、`catalog`、`synthesize` 或 `act`。
2. 描述信息形状：单一或多个、同级或主次、有序或无序、是否需要证据、证据数量和原始宽高比。
3. 从下表筛出最多三个候选；优先选择能用最少结构完整表达内容的原型。
4. 在 brief 的 `layoutDecision` 中记录候选、最终 `archetypeId` 和选择理由。理由必须说明内容关系，不能只写“更好看”。
5. 只有原型库确实无法表达内容时才允许自定义：声明最接近的基础原型、偏离点、服务的内容目标和窄屏行为。无法说明则回到基础原型。
6. 原型存在但当前渲染器未实现时，先扩展模板与验证合同；禁止借用不相容的现有 layout 冒充。

## 核心原型

| ID | 适用内容 | 稳定骨架 | 必要条件 | 窄屏行为 | 当前实现 |
|---|---|---|---|---|---|
| `centered-statement` | 单一主张、转场 | 单中心轴，短标题与一句解释 | 信息必须足以承担独立区块；否则合并 | 保持居中，收紧字号与外边距 | 待实现 |
| `split-proof` | 主张加单一证据 | 文字与媒体约 `40/60` 或 `50/50`，共享中心或顶线 | 媒体主体在缩略尺寸可辨认 | 证据优先时上下堆叠；方卡可保持紧凑双栏 | `evidence-board` |
| `stacked-proof` | 主张加宽幅完整截图 | 文案在上、证据在下，共享左右边线 | 证据适合宽幅，完整边界有意义 | 单列不变，按内容重算高度 | `hero-window` |
| `anchored-overlap` | 编辑式主张加一个具体结果 | 前景文案与媒体有明确重叠、锚点和层级 | 重叠强化因果；至少两个对齐锚点 | 降低重叠或改为上下堆叠 | `editorial` |
| `full-bleed-caption` | 氛围主导的愿景或章节 | 满幅媒体加受控标题区 | 背景主体与文案直接相关，文字对比合格 | 重设安全裁切与文字承托 | 待实现 |
| `step-sequence` | 3–6 个有序步骤 | 编号、连线或清楚阅读顺序 | 步骤有先后，标签是具体动作 | 横向流程转纵向，顺序不变 | `full-bleed`＋`contentPoints` |
| `feature-collection` | 3–6 个同级能力或对象 | 等级一致的网格、列表或轨道 | 项目真正同级，不能把主次信息硬拉平 | 多列转一列或双列 | 待实现 |
| `comparison` | 前后、A/B、选择差异 | 相同尺度的两区对照，共享标签与基线 | 两边比较维度一致 | 上下排列但保留 A/B 标识 | 待实现 |
| `metric-proof` | 1–3 个可核查指标 | 一个主指标加少量解释或小指标 | 数字有来源、边界和意义 | 主指标先行，说明紧随 | 待实现 |
| `testimonial` | 引语、人物或可信背书 | 引语为主，归属和上下文为辅 | 真实来源、非匿名伪造 | 单列，控制行长 | 待实现 |
| `gallery-mosaic` | 一个主视觉加 2–4 个补充视角 | 一主多辅，不等权拼贴 | 每张图有独立信息，主图占明显多数 | 主图先行，辅图横滑或堆叠 | 待实现 |
| `closing-action` | 价值收束与下一步 | 简短总结加一个主行动 | 只有一个主 CTA，不引入新故事 | 居中或单列，CTA 保持可见 | 待实现 |

## 快速决策表

- 只有一句结论：合并进相邻区块；确需转场才用 `centered-statement`。
- 一段文案加一张宽截图：`stacked-proof`。
- 一段文案加一张竖图或窄面板：`split-proof`。
- 需要强调文案与局部结果的关系：先尝试 `split-proof`，只有重叠能表达关系时才用 `anchored-overlap`。
- 多项有先后：`step-sequence`，不得用无序胶囊假装流程。
- 多项同级：`feature-collection`，先验证它们确实同级。
- 两种状态或方案：`comparison`，两边使用同一尺度。
- 一个主图与多个补充图：`gallery-mosaic`，不能平均分配视觉重量。
- 页面结束：`closing-action`；纯口号不能替代下一步。

## AI 选择合同

每个区块在 brief 中保存：

```json
{
  "layoutDecision": {
    "contentRole": "prove",
    "candidates": ["split-proof", "stacked-proof"],
    "archetypeId": "split-proof",
    "rationale": "证据是竖向应用列表，双栏能让主张和完整列表同时保持可读。"
  }
}
```

- `candidates` 为一至三个已登记原型，必须都与内容形状相容。
- `archetypeId` 必须出现在候选中，并与实际模板 layout 相容。
- 同一页面不为追求变化强迫每区使用不同原型；重复内容关系可以重复原型，重复节奏则通过尺度与密度处理。
- 不得先挑喜欢的构图再倒填内容理由。

## 外部来源与吸收边界

以下来源用于归纳决策，不复制其品牌皮肤或专有组件：

- [Apple Human Interface Guidelines：Layout](https://developer.apple.com/design/human-interface-guidelines/layout)：内容优先、自然阅读顺序、对齐、分组、安全区和自适应。
- [Microsoft Fluent 2：Layout](https://fluent2.microsoft.design/layout)：以 proximity 表达关系，使用间距层级、列/沟槽/边距网格和可预测对齐。
- [IBM Carbon：2x Grid](https://carbondesignsystem.com/elements/2x-grid/overview/)：8px mini unit、列行关键线、固定与流动网格以及一致节奏。
- [Material 3：Canonical layouts](https://m3.material.io/foundations/layout/canonical-examples/overview)：先从 canonical scaffold 组合页面，再为真实内容定制。
- [GitHub Primer：Layout](https://primer.style/product/getting-started/foundations/layout/)：熟悉模式、页面 regions、窄屏单列、常规宽度最多两列、宽屏按需三列。
- [GitHub Brand Guidelines：Layout](https://brand.github.com/GitHub-BrandGuidelines-2026.pdf)：单一主焦点、比例和受控负空间；只吸收构图原则，不采用 GitHub 品牌元素。
- [W3C WCAG 2.2：Distinguishable](https://www.w3.org/WAI/WCAG22/Understanding/distinguishable) 与 [Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow)：前景与背景可区分，窄屏和放大后内容仍可读。
- [pbakaus/impeccable](https://github.com/pbakaus/impeccable)（Apache-2.0）：主题替换测试、每个视觉装置必须服务内容、基于真实渲染复审；不复制其整套规则和禁用清单。
- [tommygeoco/ui-audit](https://github.com/tommygeoco/ui-audit)（MIT）：先定义用户任务，快速识别主焦点，使用 proximity 检查分组。
- [Google Labs DESIGN.md](https://github.com/google-labs-code/design.md)：把稳定视觉决策结构化保存给 AI；本项目暂不新增全局 `DESIGN.md`，只在本 skill 内保存宣传页原型合同。

来源复核日期：2026-08-30。未来更新原型时，应说明来自新内容案例、用户反馈还是来源规范变化。
