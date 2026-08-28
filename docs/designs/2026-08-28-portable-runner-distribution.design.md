# Portable Runner 单平台产品分发设计

## 问题与目标

当前 Kernel 通过环境变量或 `process.cwd()/apps/.../target/release` 找 runner。后者只在源码仓库偶然成立，会把缺失的产品资源伪装成运行时路径问题，也无法随 NPM runtime 安装和更新。

本阶段目标是在当前 macOS 平台形成唯一 shipped contract：一个 NextClaw 分发只携带一个当前 OS/arch 的共享 runner，所有 Portable Service App 复用；正常启动不需要手工环境变量，资源缺失和协议不兼容首个调用即明确失败。

## 方案

1. `apps/nextclaw-wasmtime-runner/scripts/build-product-runtime.mjs` 是源码构建 owner：构建 Rust runner 与五个 Reference Component，把 runner 同步到 `packages/nextclaw/resources/native/<platform>-<arch>/`，把 guest artifact 同步到内置 `.napp`。
2. `packages/nextclaw` 的 `resources/` 已属于 NPM 分发文件；`createNextclawDistribution` 解析当前平台 runner 的绝对路径，`NextclawDistribution` 把该宿主资源快照传给 Service。
3. Service 创建 Kernel 时注入 `portableServiceRunnerPath`；Kernel 只把路径交给 portable executor，不自行猜 package、cwd 或 Desktop 布局。
4. `PortableServiceRunnerClientService` 的路径优先级只有两级：显式 dev override，其次 Distribution 路径。任一路径缺失都 fail-fast，不扫描其它目录。
5. runner 每个 NDJSON 响应携带固定 `protocolVersion`；client 在消费结果前核对，不匹配则终止该 runner 并返回稳定错误码。

## Owner 与边界

- 构建和 artifact 同步：Rust runner app 的构建脚本。
- 分发资源绝对路径：`NextclawDistribution`。
- 产品与 App 生命周期：Kernel/App Package 现有 owner。
- Component 执行与协议校验：portable runner client。
- `.napp` 不声明 runner 路径，也不按 App 打包 native binary。

## 显式开发覆盖

`NEXTCLAW_WASMTIME_RUNNER_PATH` 保留给 runner 开发和故障注入。它是显式 dev-only override：一旦设置就完全拥有本次路径选择；路径错误不会回退到 shipped resource。未设置且 Distribution 没有提供路径时返回 `PORTABLE_RUNNER_UNAVAILABLE`。

## 验证

- 构建脚本的 target 映射、artifact 目标和命令规划单测；当前机器真实 release build 与同步。
- Distribution 路径单测和 Service → Kernel 参数链类型检查。
- runner 缺失、显式 override 错误和协议版本不匹配的定向测试。
- 清除 `NEXTCLAW_WASMTIME_RUNNER_PATH` 后启动隔离 NextClaw，真实调用多个 Component，并确认共享 runner、数据和 Resident 恢复仍成立。

## 非目标

不在本阶段实现跨平台交叉编译、签名、下载更新、runner 多版本共存、生产 sandbox 或长期 WIT 兼容策略。
