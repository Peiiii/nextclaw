# 打包与分发 Portable Service Apps

Portable Runtime 把“可移植应用包”和“原生 runner”分开。应用作者构建一份 WebAssembly Component 并打包为 `.napp`，NextClaw 提供各平台的 runner。因此，纯 WASI 应用可以使用通用产物，不必分别构建 Windows、Linux 和 macOS 的应用包。

## 打包通用应用

```bash
nextclaw app check . --json
nextclaw app test . --json
nextclaw app pack . --out reading-log.napp --json
nextclaw app validate-publish . --json
```

包中只有可移植资源时，使用 `distribution.mode: "universal"`。当前原生 runner 分发覆盖 macOS arm64、Linux x64 和 Windows x64。应用包不会带一份 runner 副本，终端用户也不需要安装 Rust、Cargo、Wasmtime 或系统 Node.js。

只有应用真的带有平台原生资源时，才选择定向分发。native-process Service 可能需要为每个支持目标提供产物；这与 Portable Component 的取舍不同。

## 安全地安装和更新

```bash
nextclaw app install ./reading-log.napp --json
nextclaw app enable <app-id> --json
nextclaw app update <app-id> --version <version> --json
nextclaw app rollback <app-id> --version <installed-version> --json
```

已安装宿主负责活动版本、受管数据、授权和生命周期操作。更新或回滚不会隐式授权新的文件夹、域名、密钥、Provider、模型或 Agent。如果新版本改变了请求，宿主会重新检查对应的授权和就绪状态。

## 默认保持自包含

可移植应用包应当是默认安装路径，其中包含 Component、Panel、清单、测试 fixture 和正常打包资源。

有时应用确实需要包外服务，例如托管 Redis 或专有 API。这种情况下：

1. 在 `requires.capabilities` 或 `requires.resources` 中声明；不能藏在代码或连接字符串里。
2. 安装时明确显示 `needs-capability` 或 `needs-configuration`。
3. 可能时提供一个已授权 Agent 能执行的安全设置操作。
4. 登录、付款、账号归属或不可逆第三方授权仍由用户完成。
5. 凭据放在 NextClaw 密钥 owner，不要放进应用产物或清单。

外部依赖不是放松包边界的理由。它是一个有文档的例外：有明确设置路径，在准备好之前不能启用。

## Marketplace 与发布检查

提交 Marketplace 前运行 `validate-publish`。它会检查应用和声明的产物结构，但不能替代你自己的 `app test`。稳定 Runtime 渠道还会在支持的平台矩阵中检查 Portable Runtime 和参考应用，全部通过后才会接受发布。

一个公开仓库可自包含运行的真实例子见 [GitHub Issue Watcher](/zh/guide/service-apps-github-issue-watcher)。
