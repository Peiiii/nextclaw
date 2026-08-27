# 受控 Node REPL 桌面能力实施计划

> 状态：Reference（当前实施计划：[Codex 风格 Node REPL 桌面能力实施计划](2026-08-26-desktop-tool-first.plan.md)）
>
> 日期：2026-08-26
>
> 设计依据：[Codex 启发的受控 Node REPL 与桌面能力收敛设计](../designs/2026-08-26-codex-inspired-desktop-context.design.md)

## 目标

让 Agent 在已授权的桌面应用上使用一个受控 `node_repl` 完成“读取状态、执行受限动作、重新读取”，而不会获得文件、网络、终端、环境变量或任意包导入能力。

## 交付批次

1. **Kernel REPL（完成）**：在 `desktop-host` feature 内实现会话级子进程 REPL、Node permission model、最小 `desktop` facade、超时/取消/空闲回收与结构化输出。
2. **同一授权链路（完成）**：将 `getAppState`、草稿写入和非高风险 AX press 映射到 `DesktopHostCapabilityManager`；状态引用必须重新校验，旧状态返回 `stale_state`。
3. **工具与用户说明（完成）**：仅注册单一 `node_repl` 工具，不暴露旧 desktop function tools；更新中英文权限说明。
4. **验证（完成）**：执行 Kernel 类型检查、定向合同/隔离/Host 测试，并在 Electron Node 模式中实际启动 macOS Desktop Host、完成 socket 状态调用与 REPL worker 冒烟。

## 验收与恢复

- 自动验收：覆盖 REPL 无 `process` 暴露、状态持久化、授权身份注入、授权隔离、状态过期、高风险点击拒绝、取消/超时与 Desktop Host 协议。
- 开发态验收：授权辅助功能后，对已登记的安全窗口执行“读取 → 写入或非提交点击 → 再读取”；撤销 grant 后确认请求不抵达 Host。
- 恢复：REPL 子进程异常、超时或取消时停止该会话的 worker，废弃状态引用；不自动重放桌面动作。
- 不在此计划内：录制、历史、锁屏、消息/联系人、坐标点击、任意 Node API、发送/提交动作。
