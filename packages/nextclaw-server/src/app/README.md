## 目录预算豁免
- 原因：该目录是 server Hono app 的路由装配根，仍需同时保留核心 router、server 入口与历史 colocated route tests；新增边界测试应优先放入 tests/ 子目录，后续再分批把根目录测试迁移出去。
