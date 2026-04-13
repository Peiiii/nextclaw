# NextClaw 桌面端 Release Channel 配置设计

## 背景

NextClaw 桌面端已经具备 `stable | beta` 更新源能力，但当前它更像底层发布参数，而不是一个正式产品能力。用户在桌面端设置页里只能控制“自动检查 / 自动下载”，不能明确选择自己跟随哪个 release channel。

这会带来两个问题：

- 产品语义不完整。既然已经存在 `stable` 和 `beta`，用户就应该能在产品中理解并控制它。
- 发布体验不统一。用户如果想提前体验 beta，只能依赖打包时约定或额外说明，而不是通过 NextClaw 这个统一入口自己完成切换。

## 目标

- 在同一个 NextClaw Desktop 应用里提供可配置的 `Release channel`。
- 先只支持 `Stable` 和 `Beta` 两个通道。
- 切换通道后，桌面端立即按新通道刷新更新状态。
- 保持“应用内闭环、用户可见、用户可控”的更新体验，不引入第二套 Beta App。

## 明确不做

- 不引入独立 `NextClaw Beta` 安装包作为主路径。
- 不做隐藏式自动切换通道。
- 不做“切回 Stable 后立即强制降级”。
- 不新增 `nightly/canary` 等更多通道。

## 产品决策

### 1. 通道就是设置项

设置页新增 `Release channel` 选择器：

- `Stable`：默认值，面向日常主力使用。
- `Beta`：提前接收新版本，风险更高。

这是一个显式设置项，不依赖命令行、环境变量或单独下载入口才能生效。

### 2. 切换通道后的行为

用户切换通道时，系统执行以下顺序：

1. 立刻持久化新的 channel。
2. 清空旧通道遗留的“已下载待应用”状态，避免继续应用错误通道的包。
3. 立即按新通道执行一次“只检查、不自动下载”的刷新。
4. 把刷新结果展示在当前更新页。

这样用户能马上知道：

- 当前跟随的是哪个通道
- 新通道有没有更新
- 是否已经切换成功

### 3. 不做隐式降级

从 `Beta -> Stable` 时，不强制回滚或自动安装更旧的 stable 版本。

规则固定为：

- 切回 stable 后，后续只跟随 stable feed。
- 只有当 stable 通道版本追平或超过当前已安装版本时，才继续提供 stable 更新。

这是更清晰、可预测的行为。它避免为了“看起来切回了 stable”而偷偷帮用户做降级。

## 实现设计

### 状态来源

保留当前 launcher state 作为唯一持久化来源：

- `channel`
- `updatePreferences.automaticChecks`
- `updatePreferences.autoDownload`
- `downloadedVersion`
- `downloadedReleaseNotesUrl`

`channel` 继续保存在 launcher state 顶层，不并入 `updatePreferences`，避免把“版本来源”与“下载策略”混成一个概念。

### 更新源解析优先级

更新源通道解析顺序调整为：

1. `NEXTCLAW_DESKTOP_UPDATE_CHANNEL` 环境变量
2. launcher state 中已持久化的 `channel`
3. 打包内置的 release metadata channel
4. 默认 `stable`

这样开发/调试仍可用 env 覆盖，正常用户则由应用内设置接管。

### UI 呈现

桌面端更新页新增：

- 当前通道展示卡片
- `Release channel` 选择器
- Beta 风险提示
- “切回 Stable 不会强制降级”的说明

保留现有：

- 自动检查开关
- 自动下载开关
- 手动检查 / 下载 / 应用

## 验证计划

- 单元测试：
  - update source 优先读取持久化 channel
  - coordinator 切换 channel 时清理旧下载状态
  - 切换 channel 会刷新可用更新状态，但不触发自动下载
- 类型 / 构建：
  - `pnpm -C apps/desktop tsc`
  - `pnpm -C packages/nextclaw-ui tsc`
- 冒烟：
  - 运行受影响测试文件，确认桌面更新链路与 UI 类型链路正常

## 对产品愿景的对齐

这个方案比“单独再做一个 Beta App”更符合 NextClaw 作为统一入口的方向：

- 用户不用理解两套入口
- 应用内即可完成通道选择、更新检查和应用
- 能力被收敛为统一体验，而不是额外分叉出一个产品表面
