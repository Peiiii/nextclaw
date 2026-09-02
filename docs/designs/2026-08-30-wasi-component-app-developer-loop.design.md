# WASI Component App 开发闭环设计

## 文档状态

- 日期：2026-08-30
- 状态：Design Ready
- 类型：Portable Runtime 已交付能力的开发者闭环补充设计
- 上位愿景：[NextClaw 产品愿景](../VISION.md)
- 运行时架构：[WASI Service App 运行时设计](./2026-08-28-wasi-service-app-runtime.design.md)
- 已知缺口来源：[Portable Runtime 交付验收](../plans/2026-08-28-portable-runtime-delivery-acceptance.plan.md)

## 一、触发证据与范围判定

远程 Linux 实例中的 Agent 使用正式 `0.45.2` 发行版开发了一个「阅读进度」schema v2 App。它能打包，直接调用正式 runner 也能通过 `host.kv` 写入并读回数据，但无法只依靠发行版完成从创建到启用的闭环；后续源码已经推进到 `0.45.4`，本设计以两次实测暴露的同一能力面为准：

1. `nextclaw@0.45.4` 的公开 NPM 产物没有 `.wit`、Rust Guest 源码或 WASI Component 模板；
2. `nextclaw app check` 只认识单个 Panel/Service 目录，Panel 校验只在旧 `workspace/service-apps` 查 Action，看不到同一 schema v2 包里的 sibling Service；
3. `app dev/call` 的底层已经会向上发现所属 schema v2 包，但公开入口只表达 Service 目录，失败时又吞掉包加载的真实原因；
4. `app install ./artifact.napp` 把相对路径原样传给运行中的宿主，宿主按自己的 cwd 解析；
5. 本地 API client 对非 2xx 只输出 HTTP status，丢弃服务端已经返回的结构化错误码与消息，导致 409 无法诊断。

这些问题共同破坏同一条用户任务，并跨越创建、检查、调试、安装和启用多个 consumer，属于“能力面缺失”。本设计只补齐这条开发闭环，不重做 Portable Runtime 架构。

## 二、冻结的用户任务

第三方开发者或 Agent 只安装正式 NextClaw 后，可以从 `nextclaw app` 入口创建一个 Rust/WASI Component App，诊断工具链、修改业务逻辑、构建并测试 Component，在包根目录检查和调试，通过相对路径安装，启用后由 Panel、Agent 或 CLI 调用同一 Service Action；任何失败都能看到稳定错误码、真实原因和下一步。

成功可由以下最小主链证明：

```text
nextclaw app create <dir> --template rust-wasi
  -> 编辑生成的 Rust Guest
  -> nextclaw app doctor --profile wasi
  -> nextclaw app build <dir>
  -> nextclaw app check <dir>
  -> nextclaw app test <dir>
  -> nextclaw app call <dir> <action> [--component <id>]
  -> nextclaw app pack <dir> ...
  -> nextclaw app install ./artifact.napp
  -> nextclaw app enable <app-id>
  -> Panel / Agent / CLI 调用同一 Action 并读回持久数据
```

## 三、唯一 owner 与主链路

### 3.1 创建

`@nextclaw/app-runtime` 的现有 `AppScaffoldService` 继续是模板 owner。新增 `rust-wasi` 模板，生成一个最小 schema v2 包，而不是在 `nextclaw` CLI 内复制模板逻辑。

生成物包含：

- schema v2 `manifest.json`；
- 一个可直接体验的 Panel；
- 一个 Rust Guest crate；
- 与当前 runner 完全相同的公开 WIT world；
- `service-app.json`；
- 本地构建说明与确定性的输出路径。

`nextclaw app create` 与独立 `napp create` 都调用同一 `AppScaffoldService`。首版不新增 SDK registry、模板下载器或多语言插件系统。

### 3.2 目标解析

包根目录、Panel 目录和 Service 目录的识别统一归 App Runtime 的 manifest owner。CLI controller 只传入用户目标与可选 `--component`：

- 目标为 Service 目录：保持现有行为；
- 目标为 schema v2 包且只有一个 Service：自动选择；
- 目标为 schema v2 包且有多个 Service：要求 `--component <id>`；
- 组件不存在或包无 Service：返回带候选列表的明确错误。

不增加第二份“包上下文”结构；调试直接复用 `AppManifestService` 解析后的 component path、permissions 和 storage owner。

### 3.3 检查

`app check` 在包根目录时先由 `AppManifestService` 验证包合同，再遍历已解析组件。Panel Action 解析优先读取同一 bundle 的 sibling Service，只有独立 Panel 才回到旧 workspace `service-apps` 查找。

单独检查包内 Panel/Service 时也应自动发现 owning package，保证组件检查与包检查不矛盾。不会删除旧独立 Panel/Service 工作流。

### 3.4 安装与错误

用户输入的本地路径必须在 CLI 进程边界规范化为绝对路径；registry selector 原样保留。宿主仍是安装、启停、冲突和数据生命周期的唯一 owner。

本地 API client 必须在非 2xx 时解析现有 `{ ok: false, error }`，保留 HTTP status、错误 code 和 message。CLI 不把冲突自动“修掉”，不静默禁用旧组件，也不增加未知 fallback；它只把真实 owner 的决定完整交给用户或 Agent。

### 3.5 WIT、构建与测试

`@nextclaw/app-runtime` 是 Guest 开发合同 owner。它只维护一份版本化的 `nextclaw:portable-service` WIT，并从同一事实源生成 Rust 模板、公开资源和发布校验，禁止 runner、模板与文档各自复制 ABI。

- `doctor --profile wasi` 只检查 Rust Guest 构建所需的 `rustc`、`cargo` 与 `wasm32-wasip2` target；宿主自带 runner，不再要求开发者安装 `wasmtime` 或 `wkg`；
- `build <package>` 识别 schema v2/Rust Guest，执行锁定依赖构建并把产物写入 manifest 指向的 `service.wasm`；
- `test <package>` 先执行完整 package check，再按模板内的最小 smoke fixture 通过正式 runner 调用 Action，证明持久写入与读取；
- `check/pack` 对 manifest Action 与 Guest `list-actions` 做双向全集比对，缺失和未声明都在安装前失败。

WIT 使用语义化版本。`0.1.x` 内只允许兼容增加；破坏性变更必须发布新 world/package 版本，并由 runner 在首个请求返回 `WASI_ABI_VERSION_MISMATCH`，不得落成模糊的进程退出。

### 3.6 可观察失败

Portable Runtime 的错误分类归 Kernel runtime owner，CLI、HTTP 与 Panel bridge 只投影同一结构化错误：`WASI_GUEST_EXPORT_MISSING`、`WASI_CAPABILITY_DENIED`、`WASI_COMPONENT_TRAP`、`WASI_ABI_VERSION_MISMATCH`、`WASI_INPUT_SCHEMA_MISMATCH`。

每次 Action 结果附带 action/component、耗时与 runner 内存快照；Guest 日志作为有界结构化记录随失败诊断返回。普通用户看到解释与修复建议，`--json` 保留稳定字段供 Agent、脚本和 CI 判断。

### 3.7 Marketplace 分发与公共合同传播

NC-165 证明原设计把开发者闭环停在了本地 artifact：`runtime.profile: "wasi"` 已进入 App Runtime、模板和 CLI，但 Marketplace 的发布解析与公开目录准入仍按 `native-process` 的旧闭集判断，导致本地校验通过后才被远端拒绝。这属于同一能力面的分发缺口，不是第二套 Marketplace，也不能由客户端提前复制远端策略来掩盖。

`@nextclaw/app-runtime` 继续拥有 schema v2 包、runtime profile、Service protocol、Component entry 和 artifact 完整性的公共合同。Marketplace 只补充它独有的发布身份、审核、目录可见性和存储策略，并复用共享 artifact validator 验证上传 bundle。新增或扩展公开 schema variant 时，设计必须列出其传播矩阵，至少核对 producer、parser/validator、序列化与持久化、目录/索引、分发与下载、安装/升级、启用与最终 runtime consumer；某一环节不适用时写明依据，不能因类型 union 已编译或本地入口已通过就宣称能力完整。

WASI Service 的组合合同冻结为：

- 根 manifest 必须是 schema v2、`runtime.profile: "wasi"`、`distribution.mode: "universal"`，并包含至少一个 Service component；
- 每个 Service component 都必须声明 `protocol: "wasi-component"` 与安全的 package-relative `.wasm` `component.entry`，artifact 必须真实包含该文件并通过 bundle path/checksum/identity 校验；
- `wasi` 不隐式获得 `nativeProcess` 权限；manifest 声明的宿主能力继续进入审核与安装授权摘要；
- 个人发布先进入 `pending`，审核后可进入现有公开 App catalog；官方与个人 scope 都走同一 runtime 合同，不靠 scope 绕过错误声明；
- Registry 下载、全新目录安装、显式 enable 和至少一个真实 Service Action 调用必须消费同一已审核 artifact，不能用本地原始目录替代发布后的包。

`native-process` 与 `panel-only` 的既有行为保持不变；根 profile 与组件协议不一致、缺少 Component、把 native Service 伪装成 `wasi`、或把 WASI 包声明成 targeted distribution 都应在写入 Marketplace 存储前明确失败。

## 四、兼容与失败边界

- 现有 `app check/dev/call <service-dir>` 完全保留；包根目录是新增等价入口。
- `app call` 使用 `--component`，不引入与现有 `<action-name>` 冲突的新位置参数。
- 生成模板固定 Rust 官方主路径；其它语言、Python/FastAPI 迁移、任意 WASI 框架不在本轮承诺。
- 未安装 Rust 工具链时，创建仍成功；doctor/build 返回平台化安装建议，不由 NextClaw 自动修改用户工具链。
- 启用发现真实 ID 冲突时仍返回冲突，不自动重命名、不自动删除 workspace App。

## 五、抽象审计

### 保留

- `.napp`、schema v2 Package/Component、Service Action、权限、数据和 Kernel 生命周期 owner；
- `AppScaffoldService`、`AppManifestService`、现有 Panel/Service checker 与本地 API client；
- 独立 `napp` CLI 和 `nextclaw app` 两个入口，但二者消费同一公共 owner。

### 新增且已付租金

- `rust-wasi` 模板：补上公开发行版无法从零开发的已证实缺口；
- 一个包目标解析方法：消除 check/dev/call 三处对包/组件识别的重复与矛盾；
- `--component`：只在一个包含多个 Service 时表达真实用户选择。

### 删除或合并

- Panel checker 不再把 `workspace/service-apps` 当成包内 Action 的唯一事实源；
- API client 不再用裸 status 覆盖结构化错误；
- WASI dev owner 不再吞掉所属包加载失败的真实原因后统一伪装为 `service.package.required`。

### 延后

- Guest SDK registry、多语言模板、远程模板下载；Rust 是本轮唯一官方 Guest 主路径；
- 自动安装或修改用户的 Rust 工具链；doctor 只诊断并给出确定建议；
- 资源配额、stream、Secret、Blob 等既有完整能力路线，不借本次开发体验补丁扩张。

## 六、最小充分验证

1. 公开模板测试：生成物包含 WIT、Cargo crate、Panel、Service 与 schema v2 manifest，`AppManifestService.load` 通过；
2. 真实 Rust 构建：在有工具链环境从生成源码构建 `service.wasm`，不复用预编译 Lab Guest；
3. 包级 CLI：`doctor/build/check/test` 通过，包根 `dev/call` 能发现 Action 并完成一次 KV 写读；多 Service 包在无 `--component` 时给出明确选择提示；
4. 安装边界：从与宿主不同 cwd 的 CLI 使用相对 `.napp` 路径，宿主收到绝对路径；
5. 错误边界：构造 `APP_PACKAGE_CONFLICT`，CLI 输出 code 与具体冲突消息，不再只有 409；
6. 正式产品链：启动真实 HTTP host，安装生成包、POST enable、通过正式 HTTP Service Action 调用并读回数据；失败响应仍为 JSON，宿主 PID 不退出；
7. 发布门：正式 NPM 产物必须能创建并构建该模板；Linux published-runtime smoke 覆盖创建/构建/检查/测试/安装/启用/调用，不再只检查 runner 文件或直接调用单一内置 Component；
8. 合同与诊断：破坏 WIT 版本、删掉 Guest export、越权访问、制造 trap 和输入 schema 错误时，CLI/HTTP 返回对应稳定错误码；Action 声明不一致在 check/pack 阶段失败。
9. Marketplace 正向链：从真实 Rust/WASI App 执行 publish，服务端完成共享 artifact 校验并进入 pending/review；审核后通过 Registry 下载，在空白 `NEXTCLAW_HOME` 安装、enable，并调用 Action 读回持久数据。
10. Marketplace 反向链：分别拒绝 profile/protocol 不一致、缺失或越界 `.wasm` entry、缺文件/坏 checksum、WASI targeted distribution；同时回归 panel-only 与 native-process 的发布和目录资格。

## 七、非目标

- 不把 WASI 变成新的 App 类型或第二套 Marketplace；它必须完整接入现有 Marketplace/Registry 主链；
- 不承诺把 FastAPI/Python 项目直接编译为该 Component；
- 不在本轮增加 Docker/POSIX、任意系统调用或 Native Provider；
- 不为了一个样例自动吞掉组件 ID 冲突、权限拒绝或生命周期错误；
- 不以“文档写了能用”替代生成、构建和正式 host 链路的自动化证据。
