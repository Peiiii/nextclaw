# v0.16.71-nextclaw-app-runtime-mvp

## 迭代完成说明

本次迭代落出了第一版独立的 `NextClaw App Runtime` 技术能力，不接入现有 `nextclaw-server`、`nextclaw-ui` 或 `nextclaw` 主产品链路，先把“一个可分发、可运行、前后端分层的小型微应用宿主”单独跑通。

本次新增的核心交付包括：

- 新建独立包 `packages/nextclaw-app-runtime`
- 新增短命令 CLI `napp`
- 支持 `napp inspect <app-dir>` 校验应用目录与 manifest
- 支持 `napp run <app-dir>` 启动本地宿主，提供 UI 静态服务和 `__napp` bridge
- 支持 `napp dev <app-dir>`，当前等价于 `run`
- 支持最小权限模型：`documentAccess`、`allowedDomains`、`storage`、`capabilities.hostBridge`
- 新增示例应用 `apps/examples/hello-notes`
- 通过 Wasm `main/app.wasm` 跑通“读取已授权目录 -> 汇总输入 -> 调 Wasm 导出 -> 返回 UI”这条完整链路
- 将新包纳入根级 `build / lint / tsc` 脚本，避免后续仓库级验证遗漏

本次实现刻意保持一条主路径：

1. 载入 app 目录
2. 校验 `manifest.json`
3. 解析用户通过 CLI 注入的目录授权
4. 启动本地宿主
5. UI 通过 bridge 调用主模块
6. 宿主读取授权目录并把聚合结果交给 Wasm

当前 Wasm 执行底座先使用 Node 原生 `WebAssembly`，并保留 `sidecar` 抽象位。这样做是为了优先验证应用形态、目录 contract、权限 contract 和桥接 contract，而不是在第一版就把实现复杂度压到 Wasmtime 进程管理上。

相关设计文档：

- [应用模型设计](../../../plans/2026-04-18-nextclaw-wasm-apps-model-design.md)
- [方案冻结稿](../../../plans/2026-04-18-nextclaw-wasm-apps-freeze.md)
- [最小实现计划](../../../plans/2026-04-18-nextclaw-wasm-apps-mvp-implementation-plan.md)
- [运行时结构设计](../../../plans/2026-04-18-nextclaw-app-runtime-structure-design.md)

## 测试/验证/验收方式

本次实际执行的验证如下：

- `pnpm install`
- `pnpm -C packages/nextclaw-app-runtime test`
- `pnpm -C packages/nextclaw-app-runtime tsc`
- `pnpm -C packages/nextclaw-app-runtime lint`
- `pnpm -C packages/nextclaw-app-runtime build`
- `pnpm -C packages/nextclaw-app-runtime smoke`
- `pnpm -C packages/nextclaw-app-runtime exec node dist/main.js inspect ../../apps/examples/hello-notes --json`
- `pnpm lint:new-code:governance`
- `pnpm lint:maintainability:guard`

关键观察点：

- `inspect` 能正确解析 `hello-notes` manifest，并输出 `main/ui/permissions` 摘要
- `smoke` 能真实启动 `napp run`
- `smoke` 会在临时目录创建两份 notes，再通过 `POST /__napp/run` 调用 Wasm 主模块
- 结果中 `documentCount`、`textBytes`、`output.output` 与预期一致
- 新增文件命名、角色后缀、class arrow methods、param mutation、react effects 等治理检查全部通过

## 发布/部署方式

当前阶段不涉及正式部署，也不接入主产品发布链路。

如果要本地体验这一版 runtime，可按下面方式运行：

```bash
pnpm -C packages/nextclaw-app-runtime build
node packages/nextclaw-app-runtime/dist/main.js inspect apps/examples/hello-notes --json
node packages/nextclaw-app-runtime/dist/main.js run apps/examples/hello-notes --document notes=/absolute/path/to/notes
```

如果后续要对外发布，建议分两步：

1. 先补稳定的 `init/create` 脚手架与更完整的 host contract
2. 再决定是否以 `@nextclaw/app-runtime` 单独发包

## 用户/产品视角的验收步骤

从用户视角，本次应能完成下面这条最小体验路径：

1. 准备一个本地 notes 目录
2. 运行 `napp inspect apps/examples/hello-notes`
3. 看到应用名称、版本、动作名、主模块路径、UI 路径和权限声明
4. 运行 `napp run apps/examples/hello-notes --document notes=/your/notes/path`
5. 打开本地输出的 URL
6. 在页面里点击 `Run Summary`
7. 页面展示目录中文件数、文本字节数和 Wasm 计算结果

如果以上步骤成立，说明“独立宿主 + 应用目录 + Wasm 主模块 + UI bridge + 目录授权”这套基础形态已经成立。

## 可维护性总结汇总

可维护性复核结论：通过

本次顺手减债：是

长期目标对齐 / 可维护性推进：

- 这次改动顺着 NextClaw “统一入口 + 能力编排 + 生态扩展”的长期方向推进了一小步，因为它把“用户自己做的小应用”收敛成了一个可复制的运行时形态，而不是继续往主产品里堆一个一次性功能
- 这次没有直接接主产品，而是先做独立 runtime 包，降低了对既有服务/UI/CLI 的耦合压力

代码增减报告：

- 新增：1350 行
- 删除：0 行
- 净增：+1350 行

非测试代码增减报告：

- 新增：1245 行
- 删除：0 行
- 净增：+1245 行

独立可维护性复核：

- no maintainability findings
- 这次属于新增用户能力，不是纯 bugfix 或纯重构，因此非测试代码净增为正是允许的
- 在新增能力前已经把范围压到最小：不做产品接入、不做市场层、不做安装器、不做通用网络执行、不做复杂 Wasmtime 进程管理
- 业务 owner 相对清晰：manifest 读取收敛到 `AppManifestService`，权限收敛到 `AppPermissionsService`，应用执行收敛到 `AppInstanceService`，宿主收敛到 `AppHostService`，Wasm 调用收敛到 `WasmMainRunnerService`
- 命名和目录结构已经按仓库治理规则收敛到明确角色后缀，没有继续制造 `logic/`、`helpers/`、`misc` 这类假角色
- 复杂度没有被隐藏到 effect、普通函数 mutation 或兜底分支里，主链路保持单一路径

治理与目录判断：

- 本次已尽最大努力优化可维护性：是
- 已优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是
- 由于这是新增运行时能力，总代码量与文件数出现净增长；该增长是最小必要增长，因为本次同时交付了 CLI、宿主、bridge、Wasm 执行、示例应用与 smoke 闭环，且刻意未引入产品耦合层、市场层和复杂 sidecar 管理
- 抽象、模块边界、class / helper / service / controller 划分比“把逻辑堆进一个 CLI 文件”更清晰，也避免了补丁式叠加
- 目录结构与文件组织满足当前治理要求；新增文件已通过 `lint:new-code:governance` 与 `lint:maintainability:guard`

后续 watchpoint：

- 如果下一阶段引入真实 Wasmtime sidecar，需要优先复用当前 `main-runner / sidecar` 边界，不要再平行长出第二套 runner
- 如果下一阶段加入更多 bridge action，应优先围绕现有 host contract 演进，而不是让 UI 直接新增散点 API

## NPM 包发布记录

本次不涉及 NPM 包发布。

判断原因：

- `@nextclaw/app-runtime` 仍处于 MVP 验证阶段
- 当前没有补 changeset，也没有进入统一发布批次
- 当前更适合作为仓库内独立能力继续演进，待 contract 更稳定后再决定是否单独发包
