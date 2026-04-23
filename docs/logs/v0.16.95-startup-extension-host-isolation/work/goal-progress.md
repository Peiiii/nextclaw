# Goal Progress

## 当前目标
- 把 `pnpm dev start` 从启动到前端和 `/api/auth/status` 可用压到 2s 级别，并保留可重复量化的瀑布流监测。

## 明确非目标
- 不以“禁用插件”破坏功能换速度。
- 不再凭感觉优化或提交。
- 不处理当前仓库里与启动优化无关的脏改。

## 冻结边界 / 不变量
- 主服务基础接口必须优先 ready。
- 插件能力可以后置接入，但最终功能契约不能丢。
- 所有结论必须能被 `scripts/smoke/startup-waterfall.mjs` 或等价实测验证。

## 已完成进展
- 前后端并行启动。
- 插件 hydration 移入 extension host 子进程。
- 推迟重型 capability warmup，不阻塞 status。
- 增加启动瀑布流脚本。
- Dev proxy 对后端启动竞态做受控处理。
- 补齐 extension host runtime state/tools/asset 契约。
- plugin reload 改为统一走 extension host。
- proxy registry 保留 providers 契约并补测试。

## 当前下一步
- 若继续本链路，优先处理前端 `bootstrap-status` 持续轮询 / “未连接” 状态机根因。

## 锚点计数器
- 当前：14/20
