---
name: code-investigation-workflow
description: 当用户要求先研究代码、排查代码、看清楚现状、判断某个组件/函数/manager/文件是什么性质、该不该改、该怎么改，要求移植/对齐外部仓库、目录、主题或内容集合，或指出“不要我说一下你才注意一下”“主动发现所有问题”“顺着代码查完整”时使用。该 skill 只规定调查方法，不承载具体架构、拆分、命名、MVP、UI 或 owner 规范；具体判断必须转交对应专项 skill。
---

# Code Investigation Workflow

## 目标

在给出代码判断或修改方案前，先把相关代码链路查完整，避免只看用户点名的一行、一个组件或一个调用点。

本 skill 只管“怎么查”。它不定义“什么是好代码”。具体规范继续由 `writing-beautiful-code`、`mvp-view-logic-decoupling`、`classic-software-design-principles`、`kernel-branch-owner-architecture`、`frontend-interaction-quality`、`frontend-style-encapsulation`、文件组织类 skill 等承接。

## 调查顺序

1. 明确用户问题的判断对象：组件、函数、文件、manager、状态、事件、工具链路，还是展示交互。
2. 读取对象本体，标出它实际做了什么，而不是只按名字判断。
3. 查所有调用方和被调用方，至少覆盖：
   - 谁给它传数据和 action；
   - 它把数据和 action 传给谁；
   - 是否存在同类调用点、同类参数搬运或同类 owner 连接。
4. 沿相关事实走一段完整链路：`producer -> owner/state -> adapter/container -> UI/consumer`。只查到局部时，结论必须标注为阶段性。
5. 扫同一文件、同一 owner、同一责任链中的相邻同类问题；用户点名的问题通常只是入口，不是边界。若当前实现是 registry / catalog / capability list 的投影，必须对照 canonical 事实源审计完整覆盖面，不能只补用户点名的单项。移植外部视觉或内容集合时，还要固定源版本并建立逐项对照表，核对当前与历史名称、真实素材路径、可直接使用还是仅概念预览、最高辨识度元素和许可边界；未经用户明确同意，不得把人物、角色、核心交互或其它高辨识度内容降级成“灵感配色”或抽象替代。
6. 再加载专项 skill 做规范判断：
   - 代码审美、拆不拆、抽象力度：`writing-beautiful-code`。
   - 前端 MVP、business/UI 边界、store/manager/presenter：`mvp-view-logic-decoupling`。
   - owner、生命周期、职责边界：`classic-software-design-principles`。
   - kernel/branch、manager/presenter/store owner：`kernel-branch-owner-architecture`。
   - 样式或交互：对应 frontend skill。
7. 输出结论前说明：已查到哪些证据、还有哪些没有查、推荐改什么、不改什么。

## 主动发现检查

回答“它是什么组件/该不该改/该怎么改”前，至少问自己：

- 这个对象是纯展示、业务容器、adapter，还是 owner？证据是什么？
- 它的 props / 参数里有没有只是路过的业务 action 或 snapshot？
- 相同 action、状态或转换逻辑是否在多个调用点重复出现？
- 调用方是否只是 layout/page/中间层，却在组装业务字段？
- 如果改这里，最近的真实 owner 是谁？是否应该直接连 owner？
- 如果不改这里，是否有更近、更上游或更下游的同类问题需要一起处理？

## 输出要求

给用户的结论必须包含：

- 对象性质：用代码证据说明它实际是什么。
- 链路范围：说明查了哪些调用方、被调用方或同类点。
- 专项规则：说明最终判断由哪个专项 skill 或原则承接。
- 当前建议：明确是改、不改、还是先补调查。

如果用户已经指出我漏查同类问题，必须联动 `learning-from-failures` 判断是否需要补强触发词或执行步骤。
