# Portable Runtime 跨 Worktree 构建缓存设计

## 状态

Design Ready（2026-09-03）

## 问题

`pnpm portable-runtime:build` 当前无条件执行六个 `cargo component build` 和一个原生 runner `cargo build`。Cargo `target/` 与产品资源目录都位于各自 worktree，因此即使 runner、Guest、WIT 和依赖完全未变，切换到新 worktree 仍会再次冷编译 Wasmtime/Spin 依赖。`--no-build` 只能靠调用者人工判断，既不能自动证明产物兼容，也不能让新 worktree 获得缺失的资源。

## 目标

- 相同构建输入在同一 Git 仓库的不同 worktree 中只编译一次。
- 命中缓存时不启动任何 Cargo 构建，仅原子同步已验证产物。
- runner、Guest、WIT、锁文件、工具链、目标平台或构建合同变化时准确失效。
- 两个 worktree 同时请求同一输入时只允许一个实际构建者。
- 缓存缺失或损坏时安全地回到真实构建，不把陈旧产物伪装成命中。
- CI、发布和现有 `portable-runtime:build` 调用方保持同一入口与产物路径。

## 非目标

- 不把主工作区里没有来源证明的旧 runner 直接认定为缓存。
- 不改变 runner、Kernel、NDJSON、WIT 或 `.napp` 产品合同。
- 不让普通前端验证启动 Portable Runtime；前端仍应优先复用兼容后端。
- 不承诺输入确实变化后的首次 Rust 构建为零成本。

## 单一 Owner 与主链路

`apps/nextclaw-wasmtime-runner/scripts/build-product-runtime.mjs` 继续是唯一公开构建 owner，保留 build plan、Cargo 执行和 CLI；`portable-runtime-build-cache.mjs` 是其内部的内容寻址缓存实现，不提供平行构建入口：

1. 创建当前平台的构建计划。
2. 对构建输入计算内容指纹。
3. 从 Git common dir 下的仓库级缓存恢复并校验 runner 与六个 Guest。
4. 命中：直接同步到当前 worktree 的标准产品资源目录。
5. 未命中：获取该指纹的原子目录锁；锁内再次检查缓存，仍未命中才执行 Cargo。
6. 对新产物计算 SHA-256，写入临时缓存目录并原子发布 manifest。
7. 从已发布缓存同步产品资源，释放锁。

调用方不新增第二套判断逻辑；`local:source-runtime`、本地安装、CI 和发布均继续调用 `portable-runtime:build`，由 build owner 自动裁决命中或重建。

## 指纹合同

指纹使用 SHA-256，并包含：

- 缓存 schema / 构建合同版本；
- 平台、架构、Cargo target、完整 Cargo 命令与 artifact 映射；
- `Cargo.toml`、`Cargo.lock`、`rust-toolchain.toml`；
- runner `src/**`、所有 Guest 的 `Cargo.toml` 与 `src/**`、`wit/**`；
- `rustc -vV`、`cargo component --version`；
- 会影响 Rust 产物的 Cargo/Rust/编译器环境变量的哈希输入。

文件以相对 runner root 的稳定路径和内容参与哈希，绝对 worktree 路径不参与，因此同内容 worktree 可命中同一 key。

## 缓存布局与完整性

默认缓存根目录：`<git-common-dir>/nextclaw-cache/portable-runtime`。可通过 `NEXTCLAW_PORTABLE_RUNTIME_CACHE_DIR` 显式覆盖；非 Git 环境回退到 runner 本地 `target/.nextclaw-product-cache`。

每个平台/指纹目录包含 runner、Guest 产物和 `manifest.json`。manifest 记录 schema、指纹、目标以及每个 artifact 的相对路径、字节数、SHA-256 和 executable 属性。恢复前逐个校验；任一缺失或不一致都视为 miss。

缓存发布使用同目录临时目录加原子 rename。缓存只保存构建产物，不写入 Git tracked 区域，不进入用户工作区 diff。

## 并发与故障

- 锁通过原子 `mkdir(<fingerprint>.lock)` 获取。
- 锁已存在时，等待该指纹 manifest 出现并通过完整性校验，不启动第二次 Cargo。
- 超过陈旧阈值的锁可被精确移除后重新竞争；正常等待超时则明确失败，不静默重复构建。
- 构建失败不发布 manifest，临时目录和锁在 `finally` 中清理。
- `--rebuild` 跳过读取现有缓存，但仍持有同一锁并覆盖发布，用于 runner 开发者显式刷新；默认不使用。

## 可观察结果

命令输出明确区分：

- `cache hit`：零 Cargo；
- `cache miss`：首次真实构建；
- `waiting for build`：等待另一个 worktree；
- `cache published`：新缓存已原子发布。

返回 JSON 增加 `cache: { status, fingerprint, directory }`，不改变现有 `target`、`runner`、`guests` 字段。

## 验证

- 单测：两个不同 workspace、相同内容、共享 cache root；第二次执行的 fake Cargo 必须为零。
- 单测：修改一个 runner/Guest/WIT 输入后必须 miss。
- 单测：缓存 artifact 被篡改后必须 miss 并重建。
- 单测：两个相同指纹并发请求只执行一次 fake build。
- 单测：平台映射、原子资源替换和 CI Rust target cache 合同保持通过。
- 运行构建脚本测试、Node 语法检查、治理检查；本任务不为验证缓存机制真实冷编译 Wasmtime。

## 取舍

选择“共享最终产物缓存”，而不是仅共享 Cargo `target/`。共享 `target/` 只能减少部分依赖编译，仍会进入 Cargo 并受不同 worktree 路径指纹影响；最终产物缓存可以对未变输入提供严格的零编译语义。未来若 runner 频繁变化，再独立评估共享 Cargo target 作为 miss 路径优化，不与本次正确性合同耦合。
