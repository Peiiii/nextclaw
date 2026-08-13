# Desktop 运行冒烟

- GUI smoke 必须证明真实窗口、真实 runtime URL、renderer load、GUI 启动的 API health 和明确 ready timeout；startup shell、进程存活、`ELECTRON_RUN_AS_NODE` 都不能代替。
- constructor 对象图或长期内存 owner 变化后使用冷启动，不以热更新实例验收。
- macOS 区分包损坏、runtime 子进程失败和 Gatekeeper/AMFI unsigned trust；Electron helper 使用 Electron-aware signing。
- Windows 同时验证 unpacked 和真实 NSIS silent install；启动子进程隐藏窗口，清理失败在 readiness 已通过后只作 warning。
- 从当前 launch 日志发现端口并验证 `/api/health`、auth/config/sessions；固定默认端口或旧后台服务不能作为证据。
- 检查当前 `main.log` 与 `service.log` 的 startup blocker、extension failed/exited、renderer gone、bundle staging 错误。
- clean profile 之外，对维护者现有 data dir 做 real-profile smoke，覆盖旧 bundle、staging、bad-version 和同版本 seed replacement。
- provider 可用时运行 `pnpm smoke:ncp-chat` 并要求非空 assistant 回复；health 只证明基础启动。
- Windows titlebar 触达时先 renderer `elementFromPoint`/app-region 命中检查，再做 native drag smoke。
