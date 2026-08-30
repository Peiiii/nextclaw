# Runtime 发布全自动化设计

日期：2026-08-29

## 背景与问题

NextClaw `0.45.3` 的 stable Runtime 资产已经由 GitHub Actions 正确发布，但父发布流程在“从上一稳定版升级”验证中失败。直接证据显示当前链路同时存在三个能力面缺口：

1. 发布执行虽然在 Actions 内完成，交付侧仍通过人工式轮询读取状态，容易让“观察发布”被误解为“驱动发布”。
2. 已发布安装验证复用了发布前 NPM metadata cache，并用空 `NEXTCLAW_HOME` 冒充旧版用户；launcher 因缺少旧 Runtime 自动自举最新版，下载进度污染 `--version` 和 `--json` 输出。
3. Runtime 子工作流在正式发布后才从零安装依赖并为四个平台编译 Rust/WASM/JS 产物。实测完整子流程 14 分 37 秒，最慢 Windows 构建为 8 分 35 秒，无法靠轮询频率或单纯缓存达到两分钟发布。

这不是一个报错点的局部测试修复，而是“准备、发布、验证、最终状态”能力面缺失。设计等级为 L3，`design-document: required`。

## 目标与不变量

一次 stable product release dispatch 后，无论操作者、Agent 或本地进程是否继续在线，GitHub Actions 必须自行完成：

```text
prepared source
  -> immutable multi-platform Runtime artifacts
  -> NPM publish and Git closure
  -> promote exact prepared Runtime artifacts
  -> public manifest/release verification
  -> real previous-stable upgrade validation
  -> NEXTCLAW_STABLE_READY
```

必须保持以下不变量：

- 发布观察者不是执行 owner；发布成功不依赖任何本地轮询、临时命令或人工修复。
- 正式发布只消费与 exact source、target version、platform/arch 绑定的不可变产物。
- 已发布验证使用全新 Registry cache，并对刚发布包的可见性做有界重试。
- “上一版本升级”夹具必须先安装官方上一版 Runtime，再执行 check、download-only、apply 和新进程验证；空 home 自举不是升级验证。
- `--json` 输出保持机器合同；下载进度不能被测试当成 JSON 或版本事实。
- 已成功的 NPM 或 Runtime 资产不得因最终验证失败而重复发布；恢复只重跑幂等验证/状态闭合入口。
- stable Runtime promotion 的目标预算为两分钟；冷构建耗时前移到 prepare，不计入正式 promotion。

## 当前链路与 owner

- producer：`npm-release-prepare.yml` 生成 exact-source 的 versioned NPM release tree。
- build owner：`npm-runtime-update-release.yml` 当前在正式发布时构建四个平台 Runtime。
- orchestration owner：`release.yml` 与 `release-beta-runtime.mjs` 调度 Runtime child workflow 并等待结果。
- validation owner：`verify-published-npm-runtime-update.mjs` 构造 published install/update 夹具。
- consumer：GitHub Release assets、gh-pages stable manifests、真实 `nextclaw` launcher 和最终 `NEXTCLAW_STABLE_READY`。

## 方案比较

### 只增加缓存

缓存 Cargo、pnpm 和部署目录能缩短冷构建，但 cache miss、macOS runner 排队和跨版本失效仍会把正式发布拖到数分钟以上，不能可靠满足两分钟，也没有修复错误升级夹具。

### 正式发布并行冷构建

让 NPM publish 与四平台构建并行可缩短总墙钟时间，但正式 Runtime 阶段仍受最慢平台冷构建约束，也没有把发布变成 promotion-only。

### 预构建不可变 Runtime，正式发布只 promotion（采用）

在现有 exact-source NPM prepare workflow 中，从同一 versioned release tree 为四个平台生成并验证签名 Runtime 产物；正式发布通过 exact prepare run id 下载这些产物，只做 GitHub Release 上传、stable manifest 切换和公网验证。该方案复用现有 prepared source owner，新增的只是同一事实的 Runtime 投影，不引入第二套 release planner。

## 冻结设计

### Prepare 阶段

`npm-release-prepare.yml` 在 NPM prepared artifact 成功后输出 `ready` 和 `target_version`，并启动四平台 matrix：

1. 下载同一次 workflow run 的 NPM prepared artifact。
2. 把 versioned release patch 导入 exact source checkout。
3. 安装依赖、编译 Portable Service App runner/WASM、构建并签名 stable Runtime bundle。
4. 执行静态链接和真实 HTTP/component lifecycle 验证。
5. 上传按 source SHA + target version + platform/arch 命名的不可变 artifact。

Prepare 可以耗时，但它由 master push 自动触发，并在正式 release dispatch 前完成。若 exact source 的 Runtime artifact 不完整，正式 product release fail closed，不回退到人工冷构建；显式 recovery dispatch 仍走同一 prepare workflow。

### Promotion 阶段

`release-beta-runtime.mjs` 接收 prepared source SHA，自动定位该 SHA 唯一成功的 `npm-release-prepare` run，并把 run id 传给 Runtime child workflow。child workflow 在有 prepared run id 时跳过 matrix build，直接下载四平台产物并发布；没有 prepared run id 的 beta/恢复路径继续使用现有冷构建合同。

Runtime child 必须核对四个平台 artifact 和目标版本完整，随后才更新 release assets 与 gh-pages。正式 stable 路径禁止静默退回冷构建，否则两分钟预算无法成为可观察合同。

### Published upgrade 验证

验证脚本拥有完整夹具：

1. 每个全局安装使用独立 NPM cache，并对 `ETARGET`/404 等发布传播状态做有界重试。
2. 当前包 identity 从已安装 `package.json` 读取，不通过会触发 Runtime 自举的 launcher 获取。
3. 下载上一 stable GitHub Release 中与当前平台匹配的官方 Runtime zip，安装到隔离 home 并写入 `current.json`。
4. 原样执行 `update --check --json`、`--download-only --json`、`--apply --json`、新进程 `--version` 和 Portable Service App call。
5. 任一步失败即使 public assets 已上传，父 workflow 仍不得输出 `NEXTCLAW_STABLE_READY`。

### Agent 与 skill 合同

`nextclaw-npm-release` 只允许一次 release dispatch。Actions 是执行 owner；Agent 可以使用一次有界 wait 获取最终回执，但等待、断线或会话结束均不影响发布。禁止在每次发布中临时编排验证命令、局部重发或靠人工轮询推进状态。恢复必须调用仓库提供的 exact-stage 自动入口。

确定性行为落在 workflow、脚本与测试；skill 只保留触发、授权、最终状态和恢复边界，不复制实现步骤。

## 失败与恢复

- Prepare 失败：不允许正式 product dispatch；修复后对同一 source SHA 重跑 prepare。
- NPM publish 失败：使用现有 checkpoint 恢复，不启动 Runtime promotion。
- Promotion 失败：保留成功 NPM，不重复 publish；对同一 version/source/prepared run 重跑幂等 Runtime publish。
- Registry 暂不可见：验证脚本内部有界重试；预算耗尽后明确失败，不要求操作者手动重复。
- Upgrade 验证失败：public assets 保留，修复验证/产品问题后运行同一自动 recovery stage，不重建或重发不变资产。

## 验证标准

- 单元测试覆盖 fresh cache、有界重试、package identity、上一 Runtime seed 和结构化输出解析。
- workflow 合同测试证明 prepare matrix、prepared run id、stable fail-closed promotion 与唯一升级验证入口存在。
- `tsc` 覆盖触达的 TypeScript/workflow owner 要求；MJS 运行 Node tests、lint 和治理检查。
- 使用 dry-run/fixture 证明一次 dispatch 后无需本地进程继续在线。
- 下一次真实 stable release 记录 promotion wall time；目标 `<= 120s`，超出只代表性能预算失败，不得触发人工发布分支。

## 删除与非目标

- 删除 stable 正式路径的发布时冷构建依赖；保留 beta 或显式 recovery 的冷构建入口。
- 删除 published validation 的 `--prefer-offline` 与空 home 假升级路径。
- 不新增第二个 release service、数据库、调度器或人工 runbook。
- 不改变用户 Runtime 协议和 launcher compatibility floor；Desktop 仅补齐通用的隐藏 Draft 控制面，不改变其构建或资产合同。

## 0.47.0 Desktop Draft 权限恢复补充

Desktop 的公开资产构建仍由独立的五平台 workflow owner 承担；但它的隐藏 Draft 必须在 immutable NPM release commit 已产生后、由同一稳定发布编排中已验证具备仓库写权限的 checkpoint 创建或复用。Desktop job 只消费该精确 `tag + target` Draft，不能在恢复时临时重新创建 release identity。

这保持了发布主链的两个不变量：Draft 在 assets 完整前始终不可见；恢复不重发 NPM/Runtime、不新建 tag，也不依赖观察者或人工 token。若 Runtime 或 Desktop 后续失败，隐藏 Draft 保留为同一 stable identity 的幂等恢复锚点。该补充只改变发布控制面的 owner 边界，不向产品构建、NPM 产物或 Runtime ABI 添加任何 feature-specific 门。

Linux APT 镜像的体积裁剪只可优化实际存在的可选 native dependency；不能把某个依赖的历史目录形状当作 Desktop 包的发布前提。缺失可选目录时跳过裁剪，仍由 APT 包生成、安装与升级 smoke 验证最终交付物。GitHub Pages 对单文件有 100 MiB 限制，因此 APT 镜像还会移除只用于离线首启加速的 `seed-product-bundle.zip`，并将镜像内元数据的 `seedBundle` 置空；普通 `.deb`、AppImage、DMG 与 Windows 包仍携带 seed。Desktop bootstrap 已有的标准路径会在没有 seed 和没有已激活 bundle 时获取签名 stable manifest 并下载首个 bundle。这个体积规则由同一个 `build-linux-apt-repo.mjs --github-pages-compatible` owner 同时供开发阶段的 Linux package 验证与正式发布消费，不能只留在发布 workflow 中。

## 抽象审计

命中的原则是 `single-complete-owner`、`equivalence-by-construction`、`tell-dont-ask` 和 `abstractions-pay-rent`。Prepare artifact 是 versioned release tree 已有事实的多平台产物投影；promotion 只消费这一事实。没有新增通用 artifact registry 或 DSL。beta 冷构建与 stable promotion 的分叉由真实发布时延合同支撑，不能合并成隐式 fallback。

设计状态：Design Ready。
