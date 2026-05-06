# Goal Progress

## 当前目标

完成 `@nextclaw/client-sdk` 的统一设计落地，让 SDK 覆盖当前前端使用能力，并让 UI 与 companion 真实接入。

## 明确非目标

- 不新增 companion/presence 专用后端 API
- 不借机重写 React hooks、query、store 或 presenter
- 不保留无意义平行实现

## 冻结边界 / 不变量

- SDK 是正式 client contract owner
- UI `shared/lib/api` 只保留薄适配
- contract type 尽量回到 server/kernel owner
- local / remote / realtime / upload 不退化

## 已完成进展

- SDK service/transport/type 结构补齐
- UI 薄适配接入完成，重复 wrapper 大量删除
- companion 继续通过 SDK 工作
- `tsc`、测试、smoke、governance 已完成
- 迭代留痕已建立

## 当前下一步

等待用户审阅实现结果；如需要再进入提交或后续拆分批次。

## 锚点计数器

- 20/20
