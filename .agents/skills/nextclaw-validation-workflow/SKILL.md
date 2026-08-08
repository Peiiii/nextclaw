---
name: nextclaw-validation-workflow
description: 用于选择和执行 NextClaw 改动后的最小充分验证；当用户要求 /validate、bugfix 验收、冒烟、收尾、发布验证，或讨论验证成本、过度验证与按风险分级时使用。
---

# NextClaw 验证流程

## 目标

验证要覆盖真实风险，不追求命令数量。每个风险优先选择一份最有证明力的证据；新增验证只有在能排除不同失败类型时才成立。

## 风险分级

### L0：文档与元信息

适用：文档、措辞、注释、普通元信息。

- 只做链接、标题、格式、结构或 diff 检查。
- build、lint、tsc、单测和冒烟默认不适用，不逐项执行来证明“不适用”。

### L1：局部低风险

适用：合同清晰的局部代码、纯样式、颜色、间距、文案展示。

- TypeScript/TSX 触达时运行最窄可覆盖改动的 tsc。
- 源码触达时最终运行一次 targeted ESLint；没有必要先跑已知会被无关债务阻塞的全 package lint。
- 纯视觉修改只需证明目标页面能加载、目标样式已生效；审美偏好可交给用户确认。除非同时改变交互或数据语义，不增加组件测试、全链路冒烟或多张截图。

### L2：局部行为与 bugfix

适用：点击、焦点、状态变化、局部业务规则、明确异常修复。

- 选择一份最贴近风险的定向测试。
- 再选择一条功能证据：真实用户路径、最贴近链路的冒烟、assembled boundary test 三者中优先级最高且成本合理的一项。
- 根因不确定、用户已报告真实失败或复现便宜时，保留修前失败证据，并用同一入口和观察指标复验；静态证据已充分或复现成本明显过高时，可以说明理由后使用替代证明。

### L3：跨边界与高影响

适用：跨 owner/transport、状态持久化、共享 contract、兼容路径、运行链路、高回归影响。

- tsc、targeted lint 和相关定向测试必需。
- 增加 assembled boundary test 或真实链路冒烟；两者都跑时必须分别证明不同风险。
- 只有影响面确实扩大时才增加 package/full regression。
- HTTP/API/transport 变更应在组装后的真实边界断言精确 contract，不只检查状态码或方法被调用。

### L4：发布与不可逆变更

适用：生产发布、迁移、更新器、凭证、不可逆操作。

读取 [发布与不可逆变更验证](references/release-validation.md)；涉及 runtime update 时同时读取 [Runtime Update 验证](references/runtime-update-validation.md)。

## 复杂 UI 专项

只有任务涉及分页/懒加载、虚拟列表瞬态、IME/选区、结构化输入、附件消费闭环、外部主题复刻等复杂 UI 风险时，才读取 [复杂 UI 验证](references/ui-validation.md)。普通 CSS、布局和审美修改不得加载该参考。

## 执行节奏

- 调查和实现阶段：只跑能指导下一步的最快定向检查。
- 实现稳定后：统一执行一次收尾验证。
- 相关实现没有变化时，不重复运行已经通过的同一验证。
- 长日志只保留结论、失败切片和 artifact 路径；不要把完整成功日志反复送回模型。

## 静态与治理检查

- TypeScript 源码、类型声明、导入导出或运行链路触达时，tsc 必跑，测试和 lint 不能替代。
- 源码、脚本、测试或运行链路配置触达时，targeted ESLint 默认必跑；package lint 只在跨文件/跨 package 影响、提交前合同或 targeted lint 无法覆盖时追加。
- lint:new-code:governance 只在新增/移动/重命名文件、改变 owner/目录/跨包依赖、触达治理敏感规则或提交前运行。
- check:governance-backlog-ratchet 只在治理规则、baseline、相关脚本变化或提交/发布闭环时运行。
- 源码类改动最终运行一次 post-edit-maintainability-guard；主观 post-edit-maintainability-review 仅按其触发条件追加。

## 生成产物

本地验证产生 ui-dist 等非交付产物时，在收尾前使用现有 clean:generated / check:generated-clean 入口恢复或确认干净。只有发布、打包或用户明确要求刷新产物时才保留，并与无关源码 WIP 分开。

## 结果表述

最终只汇报：

- 验证了什么风险、使用了什么主要证据、结果如何；
- 哪些技术路径仍未验证；
- 哪些纯视觉或主观结果需要用户确认。

不要罗列所有未触发的验证项，不要把 tsc/lint 通过写成未验证功能的“功能验证通过”。
