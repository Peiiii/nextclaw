# 真实运行实例验证

- 冻结用户真实入口：页面 URL、前端进程、代理后端、端口与具体动作；修后沿同一入口复验，不用另一个健康实例替代。
- 先确认开发链路是否热更新和返回新源码，再判断是否需要构建、冷启动或经用户同意重启。
- constructor 长期 owner、class-field 方法、内存形状或对象图变化后，热更新实例不能作为验收；使用冷启动对象图或隔离源码实例。
- 滚动压缩、重试、恢复、续跑、分页等重复转换至少跨越两次相同边界，并在第二次后完成一个下游用户动作。
- 流式状态、append-only journal、持久化投影或 hydrate 要比较同一事实前缀的实时态与冷重载态，核对稳定 ID、顺序、累计内容、终态和未完成子状态。
- 同一实体跨边界重复更新时，fixture 包含同 ID 多段增量和无新增内容的终止事件；已有故障 journal 优先复制到隔离目录冷重建。
- send/continue/edit/retry 等入口若都返回 accepted run handle，应逐入口验证持久化 `run.started` 前已进入同一 active-run owner并可立即停止。
- error-shaped terminal 启动恢复要同时验证 typed interruption reason 与用户可见错误边界，并用同文本非 interruption 错误做反例。
- 只有用户明确要求安装态近似，或当前开发链路无法覆盖风险时，才转用 `local-source-runtime-validation`，并说明替代与缺口。
