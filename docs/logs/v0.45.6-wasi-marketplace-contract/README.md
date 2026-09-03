# v0.45.6 WASI Marketplace 合同闭环

## 迭代完成说明

`.napp` schema v2 已经支持 `wasi-component` Service，但 Marketplace 发布解析仍把 Service runtime 当成只有 `native-process` 的闭集，因此合法 WASI 应用在发布入口被后端拒绝。此前方案设计和验证又只证明了 runtime 局部能力，没有强制遍历 Marketplace、Registry、安装与运行消费边界，这是 NC-165 漏检的流程根因。

本次把 WASI Component 约束收敛为 app-runtime 的共享合同 owner，并让 manifest、artifact 与 Marketplace 复用同一语义；Marketplace 允许 `wasi-component` 使用 universal distribution 公开上架，同时继续拒绝非法 runtime、权限和分发组合。Design / Validation Skill 也补上公共闭集 variant 的传播矩阵与最早生产者到最晚消费者的真实链路要求，避免同类能力再次只在局部“支持”。

修复针对根因而不是放宽单个拒绝条件：合法 WASI 走统一正向合同，native Service 的既有风险分级与公开目录限制保持不变，非法 WASI artifact、checksum、protocol、profile 和分发组合均有负向回归。

后续 runner 根因也已闭合：NextClaw 虽创建 multi-thread Tokio runtime，却把 Component 放入禁止 `block_in_place` 的 `LocalSet`，违背 Spin trigger 的普通 worker 调度合同；同时新 Rust/WASI 脚手架仍推广私有 `host.kv`，兼容实现直接读写 Spin 私有表。runner 现对齐 Spin 的 `tokio::spawn` 模型，新脚手架使用标准 `wasi:keyvalue/store`，旧 `host.kv` 与 JSON migration 只委托 Spin 公共 `StoreManager/Store`。共享 runtime、Engine、FactorsExecutor 和 Component cache 均保留，没有退回每次调用重建 runner。

## 测试/验证/验收方式

- `@nextclaw/app-runtime`：23 个测试文件、93 项通过；匹配范围 TypeScript 检查通过。
- Marketplace Worker：源码测试 9 个文件、44 项通过；TypeScript、ESLint 与 Worker build 通过。
- NextClaw CLI 发布/安装定向测试：2 个文件、14 项通过。
- 文档站构建、Skill 渐进加载预算、new-code governance、diff-only maintainability guard 和 `git diff --check` 通过。
- 隔离 D1/R2 + 真实 Worker + 当前源码 CLI 完成发布、审核、目录发现、Registry 下载、全新 home 安装、启用、WASI HTTP action、keyvalue 持久化、禁用重启后复读的完整链路。
- 发布 artifact 与 Registry 下载逐字节一致，SHA-256 为 `9a8d74a1435adfc43d519ca89f29900526943f442621fdf76c85e5b317841ab8`。
- runner `cargo test` 5 项和完整本地 smoke 42 项通过，覆盖标准 WASI KV Job/重启复读、legacy KV、并发 SQLite、取消、Resident 与 Provider。
- 真实 `napp create --template rust-wasi` + `napp build` 产出 `wasm32-wasip2` Component；公网 Issue Watcher 完成 GitHub sync 与持久化复读。
- 同机性能复测保留共享底座：热 P95 `3.68 ms`（修前 `11.33 ms`）、吞吐 `691 ops/s`（修前 `165 ops/s`）；10 action RSS `81.36 MiB`（修前 `74.59 MiB`），10 resident RSS `88.39 MiB`（修前 `90.06 MiB`）。

## 发布/部署方式

- Marketplace Worker 使用仓库既有入口 `pnpm -C workers/marketplace-api run deploy` 部署。
- Worker 已部署到 `marketplace-api.nextclaw.io` / `apps-registry.nextclaw.io`，Version ID 为 `0602c585-d219-4dd8-a460-ad689695083d`，上传与部署耗时 13.09 秒。
- 官方 `nextclaw.github-issue-watcher@0.1.0` 曾通过真实 CLI 发布并进入 Catalog/Registry，生产 bundle SHA-256 为 `b5f23b2dbfab1c158d76f7824e82f6b7943b0445f3232c27632b981ec958227e`；因正式 runtime action 未通过，收尾时已改为 `rejected/unlisted`，没有把不可运行条目留给用户。
- 唯一个人验收 App 完成 `404 -> pending -> 审核 published/listed -> Registry/Catalog -> 冷安装 5/5`，随后已审核为 `rejected/unlisted`；Registry 恢复 404、Catalog 0 条，不保留公开测试项。
- 生产安装后使用正式 `0.48.1` runtime runner 启用成功，但 action 暴露既有 runner 缺陷：`spin-key-value` 在单线程 runtime 调用 blocking 时 panic，外层表现为 7 秒预算超时。该 runner 不在本次 diff；Marketplace 生产发布、分发和安装闭环成立，action/persistence 继续由部署前同一冻结代码的隔离全链路证据覆盖，不能把本次生产 action 写成通过。官方与个人验收 App 均已退出公开面，最终 Registry 为 404、Catalog 匹配数为 0。
- 主干 [`portable-runtime-validate`](https://github.com/Peiiii/nextclaw/actions/runs/33657164113) 在 Darwin arm64、Linux x64、Windows x64 上独立复现同一 `spin-key-value` panic；三个 job 的 runner 合同、真实 HTTP、生命周期和 Kernel 持久化基础合同均已先通过，失败集中在公开 GitHub Issue Watcher 的 `issues_list`。这把残余边界确定为既有 runner Tokio runtime 配置问题，而不是 NC-165 Marketplace schema 传播问题。
- 本次只合入源码、测试、脚手架资源、规则和 changeset，不执行 NPM/runtime channel/Desktop 发布；`portable-runtime-validate` 由主干 push 自动完成三平台最终门。
- [`Docs Deploy`](https://github.com/Peiiii/nextclaw/actions/runs/33657164227) 的首次 verify 因 GitHub runner 连续四次无法连接 `docs.nextclaw.net` 失败；仅重跑失败 job 后，构建、全球部署、国内部署和线上校验全部通过。
- 本次不发布 NextClaw NPM、runtime channel 或 Desktop；app-runtime 用户可见变化由 changeset 进入后续统一稳定版。

`AUTOMATION_INTERVENTIONS: 2`。

1. 用户阻止在 runner 未变化时继续全量 Rust 重建；根因是验证流程只检查默认路径，没有先盘点已安装 runtime bundle 与发布缓存。已在 `development-validation/references/runtime-instance-validation.md` 增加通用产物复用门：核对平台、权限和 protocol/version 后优先复用，只有不存在兼容产物或打包本身是验收对象才重建。
2. Docs Deploy 首次线上校验的四次连接均超时，人工重跑失败 job 后通过。现有校验已经包含四次重试，本次不再把偶发网络故障扩大为产品源码改动；若同类故障重复出现，应由文档部署 workflow owner 增加更长退避或独立可达性探针。

## 用户/产品视角的验收步骤

1. 构建一个 schema v2、Service runtime 为 `wasi-component`、distribution 为 `universal` 的 `.napp`。
2. 发布后确认状态为 `pending`，审核前 Registry 不可下载。
3. 管理员审核通过后确认 v2 Catalog 和 Registry metadata 可见。
4. 从 Registry 下载并用全新 NextClaw home 安装、启用。
5. 调用 WASI action，确认 HTTP 能力返回真实数据且 keyvalue 数据在禁用、重新启用后仍可读取。
6. 使用 native Service 或非法 WASI 分发/权限组合，确认既有风险和拒绝合同没有被绕过。
7. 新建 Rust/WASI 模板，构建、安装并调用计数 action，确认返回 `persistedBy: wasi:keyvalue/store` 且重启后复读成功。

## 可维护性总结汇总

- 将重复的 component manifest、runtime、distribution 与 artifact 校验收敛到 `AppComponentContractService` 和纯工具合同，manifest/artifact owner 文件均降回 600 行预算以内。
- 未新增平行 Marketplace 特例或兼容 fallback；共享事实保持单一 owner，既有 native 安全策略不变。
- 自动 maintainability guard 最终无 error；近预算文件经过主观复核，无阻塞 finding。
- 新增文件均通过 planned-path/new-code governance，目录角色边界未恶化。
- 用户反馈暴露的昂贵 runtime 重建误判已收敛到 Validation owner，并以模型能力补丁标记，便于模型升级后做代表性无补丁复核；没有把个案提升到常驻 `AGENTS.md`。
- 删除 runner 生产代码对 Spin `spin_key_value` 私有表和直接 `rusqlite` 依赖；兼容入口只做协议转换。标准接口的确定性 fixture 已拆出 smoke 主文件，主文件仅净增 13 行；maintainability guard 无 error，近预算 warning 经主观复核无阻塞 finding。
- Design/Validation skill 增加上游执行合同与真实标准接口门禁，并同步压缩原有文字，Skill 总体积从修改前 `161999` 降至 `161966` bytes，没有抬高预算或增加新 skill。

## NPM 包发布记录

- 本次不执行 NPM 包发布。
- `@nextclaw/app-runtime` 存在 patch changeset，状态为 `待统一发布`；触发条件是后续 NextClaw 稳定发布批次。
- runner 调度由 `nextclaw`、新脚手架标准 KV 由 `@nextclaw/app-runtime` 的 patch changeset 跟随下一次统一稳定发布；规则治理不单独发布 NPM。
