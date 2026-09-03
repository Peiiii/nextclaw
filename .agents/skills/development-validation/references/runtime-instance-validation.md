# 真实运行实例验证

- 冻结用户真实入口：页面 URL、前端进程、代理后端、端口与具体动作；修后沿同一入口复验，不用另一个健康实例替代。
<!-- model-capability-patch: gap=验证时会把缺失默认路径误判为必须重新构建昂贵运行时; review-on=model-change; remove-when=代表性运行时验收能稳定先复用兼容产物 -->
- runtime/toolchain 本身未改时，构建前依次盘点当前产物、已安装 runtime bundle 和可信缓存；默认路径缺失不等于产物不存在。核对平台、可执行权限和 protocol/version 后复用，只有没有兼容产物或打包本身就是验收对象时才重建。
- 先确认开发链路是否返回新源码；constructor、class-field、内存形状或对象图变化后不用热更新验收，改用冷启动对象图或隔离源码实例。
- 滚动压缩、重试、恢复、续跑、分页等重复转换至少跨越两次相同边界，并在第二次后完成一个下游用户动作。
- 流式状态、append-only journal、持久化投影或 hydrate 要比较同一事实前缀的实时态与冷重载态，核对稳定 ID、顺序、累计内容、终态和未完成子状态。
- 同一实体跨边界重复更新时，fixture 包含同 ID 多段增量和无新增内容的终止事件；已有故障 journal 优先复制到隔离目录冷重建。
- send/continue/edit/retry 等入口若都返回 accepted run handle，应逐入口验证持久化 `run.started` 前已进入同一 active-run owner并可立即停止。
- error-shaped terminal 恢复同时验证 typed interruption reason、用户错误边界及同文本非 interruption 反例。
- 只有用户要求安装态近似或开发链路无法覆盖风险时，才读取[本地源码运行验证](local-source-runtime.md)，并说明替代与缺口。
