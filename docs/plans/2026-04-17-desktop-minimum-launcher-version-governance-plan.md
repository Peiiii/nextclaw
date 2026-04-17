# Desktop Minimum Launcher Version Governance Plan

## 目标

把桌面 `minimumLauncherVersion` 从“发布时顺手跟随当前 launcher 版本”改成“显式受控的兼容性下限”，避免应用内 bundle 更新被机械性打断，恢复“安装一次 launcher，后续主要靠 bundle 更新”的产品价值。

## 问题定义

当前桌面发布链路把 `apps/desktop/package.json` 的当前 launcher 版本直接传给 `bundle:build` 和 `bundle:manifest` 作为 `minimumLauncherVersion`。这会把“兼容性下限”退化成“当前安装物版本”，使 stable/beta 通道的 bundle 更新无法默认复用旧 launcher，破坏免手动下载安装的更新心智。

## 设计决策

1. 新增 source-of-truth 文件 `apps/desktop/desktop-launcher-compatibility.json`，按 channel 维护最低 launcher 兼容下限。
2. `bundle:build` 与 `bundle:manifest` 默认从该 contract 读取 channel floor，而不是从当前 launcher 版本读取。
3. release workflow 必须通过该 contract 解析 floor；禁止直接读取 `apps/desktop/package.json` 当前版本填入 update bundle / manifest。
4. `minimumLauncherVersion` 只在明确 launcher-side contract break 时允许抬高；纯 UI/runtime/plugin/bugfix 变更默认不得抬高。
5. 抬高 floor 时必须同步更新项目规则、发布 skill 与迭代说明，留下可追踪理由。

## 验收方式

- 桌面发布 workflow 中不再出现“当前 launcher 版本直接作为 minimum launcher version”的逻辑。
- `apps/desktop/desktop-launcher-compatibility.json` 成为 stable/beta 通道 floor 的唯一受控来源。
- release skill 与项目规则都明确写出“何时允许抬高 floor，何时禁止”。
- 本地命令能打印 channel floor，供 workflow 与人工发布前校验使用。
