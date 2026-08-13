# v0.33.5 NextClaw 原生 Mini App 发布

## 迭代完成说明

- 将 Panel App、Service App 与 schema v2 Mini App 的公开发布入口统一到 `nextclaw app validate-publish / publish`，用户和 AI 不再需要切换到 `napp` CLI。
- NextClaw 原生命令固定使用 bundle 分发和当前平台登录态，默认拦截 warning；个人提交如实返回 `pending`，且不暴露 token、registry、临时 `.napp` 路径或尚不可用的安装命令。
- 新增内置 `nextclaw-app-publisher` skill，负责识别组件、组织标准包、执行本地检查、登录引导、提交审核和解释真实状态；legacy app-runtime skill 仅保留 schema v1 standalone NApp 边界。
- app-runtime 新增跨 Node/Worker 的纯 artifact validator，统一校验 ZIP 结构、路径、预算、checksum、manifest、组件入口与发布 payload；Marketplace Worker 在任何 R2/D1 写入前重新验证制品。
- Marketplace 允许 `pending/rejected` 个人应用修正后重提，但在 version-level review 建立前拒绝普通用户覆盖已经发布的版本，保证旧公开版本持续在线。
- 设计与边界见 [`docs/designs/2026-08-13-nextclaw-native-mini-app-publishing.design.md`](../../designs/2026-08-13-nextclaw-native-mini-app-publishing.design.md)。

## 测试/验证/验收方式

- `@nextclaw/app-runtime`、`nextclaw`、`@nextclaw/core` 与 Marketplace Worker 的 TypeScript 检查全部通过。
- app-runtime 4 个定向测试文件 16 tests、NextClaw 发布服务 6 tests、core skill loader 13 tests、Marketplace Worker 发布保护 6 tests 全部通过。
- 触达 TypeScript 文件 targeted ESLint 零告警；app-runtime 正式 build 通过。
- 使用 `nextclaw.personal-organizer@0.1.4` 真实执行 `nextclaw app validate-publish --json`，识别 4 个 Panel、1 个 Service、bundle 模式且无 warning；重建 app-runtime 后复验源码目录没有生成新的 `0.1.4.napp`。
- schema v1 真实输入被原生命令拒绝；组装后的 Worker 测试证明非法 artifact 在任何 R2 `put` 或 D1 `run` 前失败。
- `lint:new-code:governance`、USAGE 资源同步校验和排除用户既有 `ui-dist` 工作后的 `git diff --check` 全部通过。

## 发布/部署方式

- 本批只完成本地源码、设计、测试、changeset、迭代记录与 Git 提交，不部署 Marketplace Worker、不发布 NPM、不调用真实远端发布接口，也不重启 NextClaw 实例。
- 后续统一发布批次消费 `.changeset/native-mini-app-publishing.md`；Worker 上线需另行执行部署合同和真实 staging/production smoke。

## 用户/产品视角的验收步骤

1. 对包含 Panel App、Service App 或两者组合的 schema v2 包运行 `nextclaw app validate-publish <app-dir> --json`，确认组件、包体和 warning 与源码一致。
2. 未登录时运行 `nextclaw app publish <app-dir>`，确认只引导 `nextclaw login`，不要求 raw token。
3. 使用个人账号提交，确认结果为“已提交审核 / pending”，公共应用详情和安装命令尚不展示。
4. 在发布者控制台确认待审核条目；审核通过后再验证公共 Marketplace 可见。
5. 篡改 bundle checksum、manifest 或组件路径，确认 Marketplace 在写入对象存储与数据库前拒绝。

## 可维护性总结汇总

- 复用 app-runtime 作为 manifest、bundle 与 artifact 不变量的单一 owner；NextClaw CLI 只编排用户意图，Marketplace 继续拥有审核状态，没有增加 `napp` 子进程 wrapper、第二套 Registry client 或本地审核状态缓存。
- 从 `AppBundleService` 删除重复的解包安全校验，并把 Worker artifact 校验从接近预算的 repository 抽为独立无状态 service，owner 边界比改动前更清晰。
- diff-only maintainability guard 为 0 error、2 warning：纯 artifact validator 为 547/600 行，repository 为 398/400 行且本次净增 3 行。按条件主观复核后，无需要当前继续拆分的可维护性发现；继续拆 ZIP central-directory 私有流程会暴露不安全中间态，repository 的新增 artifact 工作已完成外置。
- 新增文件通过 planned-path preflight、命名、目录、role boundary、module structure 与公共包导入治理；没有触碰或整理工作区既有 `packages/nextclaw/ui-dist` 改动。

## NPM 包发布记录

- `nextclaw`：需要 minor，changeset 已添加，待统一发布。
- `@nextclaw/core`：需要 minor，changeset 已添加，待统一发布。
- `@nextclaw/app-runtime`：需要 minor，changeset 已添加，待统一发布。
- Marketplace Worker：不作为 NPM 包发布；后续需要独立部署。
- 本次未执行 NPM 发布。
