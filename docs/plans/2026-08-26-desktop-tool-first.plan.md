# Codex 风格 Node REPL 桌面能力实施计划

> 状态：Implemented（真实 Luna `node_repl` → 微信 AX/截图读取、受窗口边界与状态保护的坐标点击、旧状态失效均已验证）
>
> 日期：2026-08-27
>
> 设计依据：[Codex 风格 Node REPL 设计](../designs/2026-08-26-desktop-tool-first.design.md)

1. 实现 session 级受限 `node_repl` worker 和最小 `desktop` SDK。
2. 移除所有模型可见的 desktop function tools，只注册 `node_repl`。
3. 保留现有 state、授权、Host RPC 与审计主链路；不建立旁路。
4. 验证工具清单、SDK 隔离、AX/视觉两类状态新鲜度、Host socket、真实 Luna Agent 与真实微信读取和安全点击。
