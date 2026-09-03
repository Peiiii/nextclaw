---
name: development-validation
description: 通用开发生命周期的「验证与测试」阶段 owner；当实现或产物需要证明行为、合同和运行链路时使用，负责按 L0-L4 选择最小充分证据，不负责可维护性 Review 或发布决策。
---

# Development Validation

## 目标

以最少充分证据验证真实风险；新增验证必须排除不同失败类型。

## 风险分级

### L0：文档与元信息

- 只做链接、标题、格式、结构或 diff 检查；build、lint、tsc、单测和冒烟默认不适用。

### L1：局部低风险

- TypeScript/TSX 触达时运行最窄可覆盖改动的 tsc。
- 源码触达时运行一次 targeted ESLint；不先跑会被无关债务阻塞的全 package lint。
- 纯视觉修改证明目标页面能加载、目标样式已生效；审美偏好交给用户确认。未改变交互或数据语义时，不增加全链路冒烟或多张截图。

### L2：局部行为与 bugfix

- 选择一份最贴近风险的定向测试。
- 再从真实用户路径、最近链路冒烟、assembled boundary test 中选择优先级最高且成本合理的一条功能证据。
- Task Understanding 选择 `reproduce` 时，保留修前失败证据，并用同一入口和观察指标证明修后通过；昂贵端到端复现可以降到命中同一违约点的边界回放或定向失败测试。
- Task Understanding 选择 `skip-reproduction` 时，核对其直接根因证据和预先声明的替代验证；只有替代证据能确定证明原合同恢复时才可通过，并披露没有修前失败基线。
- 验证中发现根因、失败边界或判定条件仍不确定时，原跳过决定失效，返回 Task Understanding 补复现，不在 Validation 内猜测成功。

### L3：跨边界与高影响

- tsc、targeted lint 和相关定向测试必需。
- 增加 assembled boundary test 或真实链路冒烟；两者都跑时分别证明不同风险。公开闭集 variant 同时读取[合同变体传播验证](references/public-contract-variant-validation.md)。
- 第三方框架/Factor/协议须用真实标准接口和上游执行形态命中触达合同；兼容接口、mock 或相邻能力不能替代，偏离另测。
- 只有影响面确实扩大时才增加 package/full regression。
- HTTP/API/transport 变更应在组装后的真实边界断言精确 contract，不只检查状态码或方法被调用。

### L4：发布与不可逆变更

读取[发布与不可逆变更验证](references/release-validation.md)；涉及 runtime update 时同时读取[Runtime Update 验证](references/runtime-update-validation.md)。

## 条件验证

- 分页/懒加载、虚拟列表瞬态、IME/选区、结构化输入、附件消费闭环或外部主题复刻：读取[复杂 UI 验证](references/ui-validation.md)。普通 CSS 和审美修改不读取。
- 用户已在真实实例复现，或任务触达冷/热启动、重复状态转换、journal/projection/hydrate、accepted run handle 或启动恢复：读取[真实运行实例验证](references/runtime-instance-validation.md)。
- 需要隔离全局安装版验证当前仓库源码：读取[本地源码运行验证](references/local-source-runtime.md)。
- 验证 `packages/extensions/*` 未发布源码：读取[本地 Extension 源码验证](references/local-extension-source.md)。
- 触达 Desktop 内嵌 Runtime 的文件集合、native resources、bundle 复制规则或产物预算：开发收尾先在当前平台运行一次 `pnpm -C apps/desktop bundle:build -- --channel stable`，用本地 bundle 的文件数、缺失资产和产物形状作快速门；通过后才运行远端多平台 Desktop 验证。不得等正式发布首次发现这类确定性打包错误。
- 对指定 session/model 执行真实 NCP chat：读取[NCP Chat 冒烟](references/ncp-chat-smoke.md)。

一次只选择当前风险需要的环境参考。

## 执行节奏

- 调查和实现阶段只跑能指导下一步的最快定向检查；实现稳定后统一执行一次收尾验证。
- 相关实现未变化时，不重复运行已经通过的同一验证。
- 目标能力的实现或装配链路继续变化后，旧证据立即失效。
- TypeScript 源码、类型声明、导入导出或运行链路触达时，tsc 必跑，测试和 lint 不能替代。
- 源码、脚本、测试或运行链路配置触达时，targeted ESLint 默认必跑；package lint 只在影响面或合同要求时追加。
- `lint:new-code:governance` 只在新增/移动/重命名文件、改变 owner/目录/跨包依赖、触达治理敏感规则或提交前运行。
- `check:governance-backlog-ratchet` 只在治理规则、baseline、相关脚本变化或提交/发布闭环时运行。
- 长日志只保留结论、失败切片和 artifact 路径。

本地验证产生非交付生成物时，收尾前使用既有 clean/check 入口恢复或确认干净；只有发布、打包或用户明确要求刷新产物时才保留。

## 输出

只报告风险、主要证据、结果、未验证路径和需用户确认的主观结果；不要把 tsc/lint 通过写成“功能验证通过”。

本阶段不做 findings-first 可维护性审查，不运行 maintainability guard，也不决定改动是否可以发布；失败时返回证据和正确返工目标。
