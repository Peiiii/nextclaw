# v0.45.3 Spin Portable Runtime

## 迭代完成说明

本批将正式 Portable Runtime 从自维护的直接 Wasmtime host 迁移为嵌入式 Spin 4.0.2 Runtime Factors，同时保持 `.napp`、WIT、NDJSON、权限、数据目录和发布 artifact 合同不变。旧 executor 已删除，没有形成长期双实现。

本批也建立了外部依赖 readiness 的第一条产品纵向合同：默认 App 仍然自包含且直接可用；只有 manifest 显式声明 capability/resource 时，API、CLI 与 UI 才显示 `needs-capability` / `needs-configuration`，并在实际激活前稳定拒绝。安装、未启用状态下的版本切换仍被允许；已启用 App 的失败更新会保留原运行版本。

需要诚实区分：Provider catalog、resource binding、Secret/授权 owner 与 AI 自动配置尚未实现，本批没有用兜底或文案假装它们已经可用。它们是总体计划的后续独立纵向闭环。

## 测试/验证/验收方式

- Spin release runner 构建与五 Guest smoke 通过，覆盖 Action、Host KV、权限拒绝、Provider、Composition、Resident、同 PID 与 stop 后资源释放。
- Kernel 真实 portable runtime 集成 6 项通过；首次运行抓到的 Factor 配置缓存串用问题已经修复并增加隔离回归。
- 真实产品 HTTP smoke 通过：干净 home、内置 App enable、5 个 Service Component、Provider/Resident running、`counter_read`；Rust Guest 的 doctor/create/build/check/test/dev/call/pack/install/enable/action 全链通过。
- Readiness 与真实 registry artifact 生命周期 14 项、UI 10 项通过；Kernel/UI `tsc` 通过；触达文件 ESLint 0 error。
- 文档站构建与中英文同步检查通过；`git diff --check` 通过。

## 发布/部署方式

本批按用户授权提交并合入 `master`，由既有 Portable Runtime CI 在 macOS、Linux 与 Windows 原生构建环境执行最终矩阵。本记录不把“合入主干”写成已经发布稳定版本；NPM/runtime/desktop 发布仍走统一 release workflow。

## 用户/产品视角的验收步骤

1. 安装并启用不声明外部依赖的 Portable App，确认无需额外设置即可使用 Action、数据持久化、Resident 与 Provider。
2. 查看显式声明 capability/resource 的 App，确认产品在启用前展示友好的额外要求，而不是暴露 Redis 端口、命令或 Secret。
3. 尝试启用未满足要求的 App，确认返回结构化 `APP_PACKAGE_NOT_READY` / HTTP 409；CLI 与 UI 消费同一 readiness 事实。
4. 对正在运行的 App 更新到未满足依赖的候选版本，确认候选不会被激活，原版本和数据继续可用。

## 可维护性总结汇总

- 以 Spin Runtime Factors 替换自维护 bindings，删除旧 `bindings.rs` 和直接 executor，保持一个执行 owner。
- Factor app cache key 纳入数据目录、storage、网络和 provider grants，避免跨权限复用实例。
- Readiness 和 host target 从接近预算的 manager 中抽为单一 service；UI readiness 投影抽为共享 helper。
- diff-only maintainability 最终 0 error；三个既有/临界大文件保留 warning，但本批已减少 manager 与 card 的行数。后续缝为继续拆分 manager 的版本生命周期测试 fixture 与 card 的详情区块。
- 文件命名、目录治理和 backlog ratchet 已通过。

## NPM 包发布记录

- 需要随下一次统一稳定版发布，因为 runner 实现、Kernel 公共返回合同、Server/CLI/UI 用户行为均有变化。
- Changeset：`.changeset/adopt-spin-portable-runtime.md`。
- 涉及包：`nextclaw`、`@nextclaw/kernel`、`@nextclaw/server`、`@nextclaw/ui` 及 Runtime artifact。
- 当前状态：待统一发布；本批未单独发布 NPM、Runtime 或 Desktop。

## 关联产物

- [稳定设计](../../designs/2026-08-28-wasi-service-app-runtime.design.md)
- [总体阶段计划](../../plans/2026-08-28-portable-capability-runtime-overall.plan.md)
- [工作笔记](work/working-notes.md)
