# WASI Component App 开发闭环

## 迭代完成说明

本迭代把 WASI Component App 从“只能运行内置二进制样例”推进为可由开发者从零创建、构建、验证和安装的完整产品能力。

根因有两部分：其一，运行时已经支持 `wasi-component`，但没有公开 WIT、Rust 模板、包级 CLI 和可复现构建合同，导致运行能力与开发能力割裂；其二，NPM 安装链仍携带需要本机编译的 SQLite 原生依赖，支持声明与 Node.js 20 等真实用户环境不一致。它们分别通过真实 Linux 反馈、已发布包内容检查、CLI 复现和端到端运行验证确认。

修复直接作用于两条根链路：发布稳定的 WIT 与 Rust 工程模板，并让同一套 App owner 提供 `doctor/create/build/check/test/dev/call/pack/install`；同时移除 `better-sqlite3` 安装依赖，Node.js 22+ 使用内置 `node:sqlite`，Node.js 20 使用同文件格式的 `sql.js` WASM SQLite。没有以复制 runner、放宽错误或只修单台服务器替代产品修复。

此外，工作树与 CI 统一从 `.nvmrc` 读取 Node.js `22.23.2`，发布验证覆盖 Node.js 20.19 支持线，并新增显式触发的“省 Token 模式”，只在可量化净节省为正时委派独立、只读或机械任务。

## 测试/验证/验收方式

- `@nextclaw/app-runtime`、`@nextclaw/kernel`、`@nextclaw/server`、`nextclaw`、Desktop TypeScript 检查通过。
- App Runtime、Kernel、Server 与 CLI 定向测试共 72 项通过；Node.js 20 SQLite 迁移与并发关闭场景通过。
- Rust runner 测试覆盖 capability denied、输入 schema、缺失 export、ABI 不兼容和 guest trap 的稳定错误映射。
- `lint:new-code:governance` 与 diff-only maintainability guard 通过，后者为 0 error。
- 真实 HTTP 验收从 `rust-wasi` 脚手架开始，完成构建、fixture 测试、相对路径安装、启用、`counter_increment` 与 `counter_read` 持久化读回；同时验证内置包 5 个 Service Component、provider 与 resident 均可运行。
- 本地打包后的 `nextclaw` 已分别在 Node.js 20 与 Node.js 22 的干净目录安装并完成 session catalog 写入、关闭和读回。
- 中英文文档构建、命令镜像与客户端 API 文档同步检查通过。

## 发布/部署方式

本次只完成代码、文档、changeset 与提交，不执行 NPM、Runtime、Desktop 发布或线上部署。后续正式发布继续由单次 `release.yml target=all` 统一编排，并由新增的 Node.js 兼容矩阵和真实 portable runtime HTTP smoke 作为门禁。

## 用户/产品视角的验收步骤

1. 运行 `nextclaw app doctor --profile wasi`，确认当前机器具备 Rust WASI 构建条件。
2. 运行 `nextclaw app create reading-log --template rust-wasi` 创建完整根包、Panel、WIT、Rust workspace、锁文件和 smoke fixture。
3. 依次运行 `nextclaw app build reading-log`、`nextclaw app check reading-log` 与 `nextclaw app test reading-log`。
4. 使用 `nextclaw app dev reading-log --component <id>` 或 `nextclaw app call reading-log <action> --component <id>` 调试真实 Guest。
5. 使用 `nextclaw app pack reading-log` 打包，再以相对或绝对路径安装；启用后验证写入与读取在独立实例数据目录中持久化。
6. 在 Node.js 20.19+ 或 Node.js 22.12+ 的普通 NPM 环境安装 NextClaw，不要求 Python、C++ 编译器或额外 SQLite 工具链。

## 可维护性总结汇总

本轮优先复用 App Runtime、Kernel、Server 和 CLI 的既有 owner，没有新增平行运行时。包目标解析、测试编排、SQLite driver 与错误映射分别落到单一职责模块；删除 Desktop 中仅服务于 `better-sqlite3` 的 loader/register 路径。新增文件和目录通过命名、角色边界、公共导入、扁平目录与状态 owner 治理。

自动 maintainability guard 最初识别出 9 个结构性错误；完成拆分和回归后为 0 error、9 warning。警告集中在既有或接近预算的长文件，新增功能没有继续扩张已超限的 manager，真实发布 smoke 保留为最终门并已拆出阶段 helper。

## 红区触达与减债记录

### packages/nextclaw-kernel/src/managers/service-app.manager.ts

- 本次是否减债：是。
- 说明：稳定错误映射移入独立 utility，manager 总行数较基线减少。
- 下一步拆分缝：后续可按生命周期探测与运行实例注册拆分，但本次不为消除警告扩大改动范围。

### packages/nextclaw/src/cli/app/services/service-app-dev.service.ts

- 本次是否减债：是。
- 说明：schema v2 包目标与权限解析移入 `development/service-app-package-target.service.ts`，保持单一事实源。
- 下一步拆分缝：若调试协议继续增长，再将 runner transport 与报告格式化分别抽离。

## NPM 包发布记录

需要在后续稳定版统一发布：`nextclaw`、`@nextclaw/app-runtime`、`@nextclaw/kernel`、`@nextclaw/server`。当前仅生成 changeset，均处于待统一发布状态；本次没有执行 registry 写入。
