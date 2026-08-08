# Runtime Update 验证

仅在触达 runtime update builder/source/host、download/apply、launcher 选包、managed service relaunch、restart 或更新后版本展示时读取。

- 默认运行 pnpm dev:verify-update；builder、打包输入、fixture 指纹或缓存机制变化时，至少一轮增加 --rebuild。
- 使用当前工作树构造隔离 baseline/candidate，不命中全局 nextclaw，不读写真实 ~/.nextclaw。
- 观察 baseline/candidate 版本、check、download、apply、旧/新 PID、current.json 和清理结果；只验证本次变化涉及的观察面。
- 若平台、依赖或构建条件阻塞，明确写出 runtime update 功能未验证及剩余缺口，不能用 tsc 或单测代替。
