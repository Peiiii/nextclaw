# Goal Progress

## 当前目标

一次性收敛 workspace import alias 中明显的问题，而不是只改一个包。

## 明确非目标

不全仓批量替换所有 app / worker / CLI 的 `@/*`，不为简单 library 强行登记 alias。

## 冻结边界 / 不变量

- app / worker / UI app layer 可以继续使用 `@/*`。
- 跨包公开引用继续使用 package name。
- `@kernel/*` 只允许 kernel 内部源码使用，consumer 只在配置层识别。

## 已完成进展

- kernel 登记并使用 `@kernel/*`。
- agent-chat-ui 删除未使用的 `@/*` 配置。
- consumer 编译配置补齐 kernel 源码解析。
- kernel events 命名与 module-structure 合同补齐。
- 核心 tsc/build/governance 验证通过。

## 当前下一步

等待用户确认是否提交。

## 锚点计数器

19/20
