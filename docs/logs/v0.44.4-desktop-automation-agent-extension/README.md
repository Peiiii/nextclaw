# Desktop 自动化 Agent 与扩展统一授权链路

> 2026-08-27 后续批次：工具形态已收敛为受限 `node_repl` + 私有 `desktop` SDK；本批次只完成定向自动验证。真实微信“读消息—写入—发送—回读”仍未通过，不得作为已验收能力对外宣称。

## 迭代完成说明

- 将 Agent 纳入 Desktop Host capability 的一等调用方，授权主体稳定绑定 `agentId`，不绑定会话、运行或模型。
- Agent 入口收敛为一个受限 `node_repl` 工具，注入私有 `desktop` SDK；SDK 暴露 `getAppState`、`setValue`、`click`、`typeText`、`pressKey` 原子操作，不按“发送/确认”等按钮文案另设产品级阻断。
- Agent 与 Extension 共用 capability grant、目标解析、Host client、错误模型和审计事件；模型参数不能伪造调用主体。
- 新增统一授权弹窗和“设置 > 桌面操作”页面，支持查看 Host/TCC 状态、按 Agent 或 Extension 授权以及精确撤销。
- 新增微信 Desktop Extension，使用正式 observation 链路持续读取可见 AX 文本、生成稳定事件 ID/cursor，并过滤 `🤖[墨爪]` 自身消息前缀。
- macOS 原生 `setValue` 完成后回读 `AXValue`，把 `verified` 与 `observedValue` 经 Host 协议返回。
- `pressKey` 采用 Service 独立原生 helper 承载 Quartz 键事件，避免原生事件异常杀死 Host Worker；helper 只构建于 macOS，且不依赖 Electron 窗口。该路径尚未完成微信快捷键实测。

## 测试/验证/验收方式

- Kernel：Desktop capability、grant、observation、Extension runtime、Panel/Service grant migration 与 Agent tool provider 定向测试通过；TypeScript 检查通过。
- Server：capability access、event stream、Panel App 与 Service App controller 共 44 个测试通过；TypeScript 检查通过。
- Client SDK：capability access service 测试与 TypeScript 检查通过。
- UI：授权弹窗与设置页 2 个测试、TypeScript 检查和 Vite 生产构建通过；已在本地开发页面人工检查设置入口、状态、按钮语义与空态布局。
- Desktop：主进程编译通过，Host 与 shell capability 共 15 个 Node 测试通过；macOS arm64 Objective-C++ Accessibility adapter 独立编译通过。
- Extension SDK：Desktop Host 与 Observation 共 3 个测试及 TypeScript 检查通过。
- 微信 Desktop Extension：3 个语义提取/去重/清理测试、TypeScript 检查与包构建通过。
- 尚未完成真实微信“读取—输入—发送—回读”及已安装 Desktop 包的 TCC 冒烟；不能把该部分声明为已验证。

## 发布/部署方式

本轮未提交、未推送、未发布、未部署，也未重启 NextClaw。变更已接入 Desktop package build/verify、product bundle 和 dev runtime TypeScript 构建清单，后续随统一版本交付。

## 用户/产品视角的验收步骤

1. 打开“设置 > 桌面操作”，确认能看到 Desktop Host 与辅助功能权限状态。
2. 让某个 Agent 在 `node_repl` 中调用 `desktop.getAppState`；首次缺少 `ui.read` 授权时应出现包含 Agent、目标应用、权限范围和风险说明的授权弹窗。
3. 允许后让同一 Agent 在另一会话重试，授权应继续有效；其他 Agent 不应继承该授权。
4. 调用 `desktop.setValue` 或 `desktop.typeText` 写入草稿，结果应包含原生回读验证；按钮语义不由 Desktop SDK 拦截，仍受授权、目标绑定和状态新鲜度约束。
5. 安装并启用微信 Desktop Extension 后订阅消息 observation，确认只产生去重后的外部可见消息事件，且取消订阅会释放底层 watch。
6. 在设置页撤销精确授权后再次调用，应该重新触发授权请求。

## 可维护性总结汇总

- 调用主体、授权存储和 Host 执行保持单一 owner，没有给 Agent 建立旁路 socket、环境变量或 shell 通道。
- Agent 工具只做受信运行上下文到 capability manager 的薄适配；Extension 连续观察继续归 Observation manager 管理生命周期。
- 风险边界集中在 capability access 合同中，当前写能力严格停在草稿，不通过模糊 fallback 兼容发送行为。
- 微信语义解析目前只承诺有界可见文本与稳定去重，不把未经真实版本矩阵验证的控件层级包装成稳定公共合同。

## NPM 包发布记录

本轮未发布 NPM 包。changeset 已覆盖 Kernel、Server、Client SDK、UI、Extension SDK 和微信 Desktop Extension；等待用户明确授权后的统一发布流程处理。
