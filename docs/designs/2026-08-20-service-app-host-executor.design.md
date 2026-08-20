# Service App 宿主执行器与桌面内置 Node 设计

## 文档状态

- 日期：2026-08-20
- 状态：设计冻结，进入实现
- 上游设计：
  - [Service Apps 与 MCP Gateway 讨论记录](./2026-05-27-service-apps-mcp-gateway-discussion.md)
  - [统一 Runtime Child Env 设计](./2026-06-04-unified-runtime-child-env-design.md)
  - [Mini App 组合包与应用市场方案设计](./2026-08-12-mini-app-package-and-marketplace.design.md)
  - [原生 Service App 多平台 Artifact 与 Marketplace 可安装性设计](./2026-08-18-native-app-platform-artifacts.design.md)
- 触发问题：Windows Desktop 0.40.0 在未安装系统 Node.js 时，内置个人空间的收藏、日历等 Service actions 统一失败为 `spawn node ENOENT`，最终被 server 暴露为非结构化 HTTP 500。
- 本文拥有：Service App 已解析 `command + args` 到实际宿主进程的执行器解析、宿主 Node 保证、兼容语义、失败边界和桌面验证合同。
- 本文不改变：MCP stdio 协议、Service Action 授权、App Package 多平台 artifact 选择、Panel App bridge、Service App 数据目录。

## 一、决策摘要

NextClaw 保持 Service App 语言无关，不把所有 Service App 固定为 Node。运行时接受的启动方式仍然可以是宿主 Node、包内原生进程或显式系统命令，但必须在启动前收敛为一份确定的执行计划。

冻结以下合同：

1. `service-app.json` 的 `command: "node"` 或 `command: "node.exe"` 是 **NextClaw 宿主 Node 别名**，不是 PATH 中任意系统 Node 的请求。
2. 宿主 Node 别名始终解析为当前 NextClaw 产品运行时的 `process.execPath`；Desktop 运行在 Electron Node mode 时，子进程必须显式携带 `ELECTRON_RUN_AS_NODE=1`。
3. 宿主 Node 解析是确定性主合同，不执行“先找系统 Node，找不到再回退内置 Node”的环境相关 fallback。
4. 非 Node 命令保持开发者自定义：
   - `./relative/path` 表示包内或 Service component 内的进程；
   - bare command（例如 `python3`、`git`）表示显式系统依赖，缺失时 fail-fast；
   - `launch.targets` 继续在安装/解析边界选择平台命令，runtime 不再选择平台。
5. `McpServiceAppRuntimeService` 是 Service App 启动执行计划的 owner；底层 MCP lifecycle 只消费已经解析的 `command + args + env`，不重复解释 manifest。
6. Service App 与 Extension 的宿主 Node 语义必须由同一个公共解析机制生成，禁止两个 runtime 分别维护 `node` 特判。
7. 启动、握手或调用失败必须转换为结构化 Service App runtime 错误；server controller 不再把已知上游失败抛成裸 `Internal Server Error`。
8. 内置个人空间继续使用零依赖 JavaScript Service 和宿主 Node，不为了规避该宿主缺口改写成五个平台的原生二进制。
9. Marketplace 不需要为本次修复重新发布个人空间 App：它是随 NextClaw runtime 分发和启动的内置包，修复载体是 NextClaw NPM/runtime channel；Desktop 用户还需要能够取得包含该 runtime 的 Desktop product update。若实际发布拓扑检查证明内置 App 由独立 Marketplace artifact 覆盖，再追加对应发布，不能凭猜测重复发布。

## 二、可观察问题与不变量

### 2.1 当前失败

个人空间的待办、笔记、收藏和日历共用一个 Service component：

```json
{
  "command": "node",
  "args": ["index.mjs"]
}
```

NPM/终端环境通常在 PATH 中存在 `node`，因此问题被隐藏。Desktop 的产品 runtime 由 Electron executable 通过 `ELECTRON_RUN_AS_NODE=1` 启动；Electron 内含 Node runtime，但安装目录不保证存在名为 `node.exe` 的独立文件。Service runtime 直接 `spawn("node")` 时会依赖用户系统 Node，Windows 裸机因此失败。

### 2.2 必须成立的不变量

- 同一 NextClaw 版本、同一 App artifact 和同一 Host Target，应产生同一 Service 启动行为，不因用户是否偶然安装系统 Node 而变化。
- NextClaw 宣称“宿主提供 Node runtime”的 JavaScript Service，必须在 NPM、Desktop、自动启动和最小 PATH 环境下可运行。
- Service App 仍可使用 Rust、Go、Python 或任意 MCP stdio server；宿主 Node 能力不能收窄语言无关模型。
- 一个 Service App 对应一个启动进程和多个 actions；执行器按 Service 解析，不按 action 重复选择。
- 平台 artifact 和 `launch.targets` 在安装/manifest parser 边界完成选择；Service runtime 只启动已解析的单一计划。
- 已知 runtime 不可用必须返回稳定错误码和可理解信息，不能让 Panel 收到非 JSON 500。

## 三、范围判定

这是 **能力面缺失**，不是只改个人空间 manifest 的局部 bug：

- 同一问题影响所有使用 `command: "node"` 的内置和社区 Service Apps；
- NPM runtime、Desktop Electron runtime、自动启动和本地开发对同一声明可能产生不同结果；
- Extension runtime 已把 `node` 解析为 `process.execPath`，Service runtime 却只补 PATH，形成两个不一致 owner；
- 只给个人空间写绝对路径或打包 Rust 不能关闭第三方 JavaScript Service 的复发半径。

最小完整范围是“统一宿主 Node 执行器 + Service runtime 错误边界 + packaged Desktop 验证”。不扩大到通用进程沙箱、Python runtime 管理器或新的 Service manifest 大版本。

## 四、候选方案

| 方案 | 可预测性 | 兼容与开发体验 | 跨平台成本 | 结论 |
| --- | --- | --- | --- | --- |
| 为内置个人空间发布多平台 Rust 二进制 | 高 | 不能修复其它 JS Service | 需要多 artifact 构建、审核和更新 | 不采用 |
| 优先系统 Node，缺失时回退 Electron Node | 低 | 表面兼容，实际 Node 版本随机器漂移 | 调试与 ABI 风险高 | 不采用 |
| 给每个 Service artifact 捆绑 Node | 高 | 包巨大、重复运行时和安全更新 | 每个 App 重复分发 Node | 不采用 |
| `node` 作为宿主 Node 保留别名，其他命令保持自定义 | 高 | 兼容现有模板；语言无关 | 一次修复所有宿主 | 采用 |
| 立即引入全新的 typed executor manifest | 高 | 最显式，但要求 schema、CLI、发布与迁移同步 | 本次范围过大 | 暂不采用 |

长期可以在未来 manifest 版本中把执行器显式写成 `host-node | package-process | system-command` union；当前已有公开样例和包普遍使用 `command: "node"`，将该值规范化为宿主 Node 是最小兼容合同。未来 typed executor 只能替代该规范表示，不能重新引入系统 Node 优先级。

## 五、规范启动模型

### 5.1 输入分类

```text
service-app.json
  ├── command: node | node.exe  ──> host-node
  ├── command: ./...            ──> package-process
  ├── command: <bare command>   ──> system-command
  └── launch.targets            ──> parser 先选 target，再进入以上分类
```

### 5.2 Host Node 执行计划

概念类型：

```ts
type ServiceProcessLaunch = {
  command: string;
  args: string[];
  cwd: string;
  env: Record<string, string>;
};
```

解析规则：

```text
普通 Node/NPM 宿主
  command = process.execPath
  args = manifest.args

Electron Node-mode 宿主
  command = process.execPath  // NextClaw executable
  args = manifest.args
  env.ELECTRON_RUN_AS_NODE = "1"
```

宿主 Node 子进程继续使用隔离的 runtime child env：注入 App storage 目录和必要 PATH，清除不安全的 `NODE_OPTIONS`。`ELECTRON_RUN_AS_NODE` 是执行器所需的选择性 capability，不等同于继承全部父进程环境。

### 5.3 自定义进程

- package-relative command 按 Service component directory 作为 cwd；安装校验继续确保包内路径不逃逸并恢复 executable bit。
- bare system command 按 runtime child PATH 解析；不存在时返回明确的 executable-not-found runtime 错误。
- 不把 package process 失败自动换成 Node，不把 system command 失败自动换成同名宿主能力。
- 原生多平台包继续由 `distribution.targets` 和 `launch.targets` 保证当前 artifact 有且只有一个有效启动命令。

### 5.4 生命周期

```text
manifest 静态列表（纯读，不启动）
          ↓
discover / invoke（显式执行）
          ↓
ServiceAppManager 校验 action 与 grant
          ↓
McpServiceAppRuntimeService 生成唯一 launch plan
          ↓
MCP lifecycle 启动并握手
          ↓
复用连接执行多个 tools/call
```

`restart` 关闭缓存连接并回到 `idle`；下一次 discover/invoke 使用同一确定解析规则重新启动。进程崩溃或握手失败进入 `failed`，保存最近错误；不得静默换执行器重试。

## 六、错误与恢复合同

本次交付保持既有 authorization、action-not-found、contract-mismatch 错误 owner，并将启动、握手和运行期调用失败统一归一化为 `SERVICE_APP_RUNTIME_FAILED`。HTTP controller 将其映射为 502 和结构化 `{ ok: false, error: { code, message } }`，避免框架返回 HTML 或裸 `Internal Server Error`。

未来若 UI 需要针对不同故障提供不同恢复动作，再在 runtime 层保留失败阶段并细分 `SERVICE_APP_EXECUTABLE_NOT_FOUND`、`SERVICE_APP_RUNTIME_START_FAILED` 与 `SERVICE_APP_ACTION_FAILED`；在没有消费方之前不提前扩张错误枚举。

Panel 可以展示简洁的可恢复状态和“重试/检查服务”，不得展示裸 endpoint、HTML 或 `Internal Server Error` 文本。

失败不会自动修改或删除 App data。收藏和日历的 list action 是纯读；服务未启动时数据目录保持原样。修复后下一次调用可直接恢复读取，无迁移步骤。

## 七、兼容矩阵

| 场景 | 解析结果 | 预期 |
| --- | --- | --- |
| NPM/CLI，`command: node` | 当前 Node `process.execPath` | 成功，不依赖 PATH 中另一个 Node |
| Desktop Windows，无系统 Node | NextClaw.exe + Electron Node mode | 成功 |
| Desktop macOS/Linux，无系统 Node | 产品 executable + Electron Node mode | 成功 |
| Desktop/CLI，系统另有不同版本 Node | 仍使用宿主 Node | 行为不漂移 |
| `command: ./bin/service` | 包内 executable | 按当前 artifact 启动 |
| `launch.targets` | parser 精确选择当前 target | runtime 只看到单一 command |
| `command: python3` 且系统缺失 | system-command fail-fast | 结构化 `SERVICE_APP_RUNTIME_FAILED` |
| 旧安装的个人空间数据 | 不迁移数据 | 修复后原地读取 |
| Service restart / 产品重启 | 重新生成相同 launch plan | 不改变执行器 |

## 八、实现边界

### 8.1 Owner

- `@nextclaw/core`：提供可复用的宿主 Node launch 解析/环境能力，隔离 Electron 与普通 Node 的差异。
- `McpServiceAppRuntimeService`：将 Service manifest 解析成 MCP stdio transport 定义，并把 runtime 异常转换为 Service App 领域错误。
- Extension lifecycle：迁移到相同宿主 Node owner，删除本地 `node` 特判。
- server controller：只负责领域错误到 HTTP 的映射，不解析 spawn/MCP 错误文本。
- Desktop：继续负责把产品 runtime 以 Electron Node mode 启动；不为每个 Service 生成 `node.exe` 或复制 Node runtime。

### 8.2 禁止新增的平行路径

- 不给个人空间写专属 Desktop 启动器。
- 不在 Panel 中识别 `spawn node ENOENT` 后重试。
- 不在 Service runtime 扫描 nvm、fnm、asdf、Program Files 或多个 Node 目录。
- 不同时维护“系统 Node 优先”和“宿主 Node 优先”两条 shipped runtime 路径。
- 不把 Extension 的现有特判复制到 Service runtime；应收敛成公共 owner。

## 九、验证标准

实现完成至少证明：

1. 宿主 Node resolver 在普通 Node 和 Electron Node-mode 两种输入下生成正确 command/env。
2. Service App `command: node` 在 PATH 不含 Node 时仍能完成 MCP initialize、tools/list 和 tools/call。
3. 系统 PATH 中存在另一个 Node 时不会被选中。
4. 自定义非 Node command 原样保留，缺失时返回结构化错误。
5. 内置个人空间在隔离临时数据目录中完成 `favorite_list` 和 `event_list`，并覆盖至少一个写入后读取 action。
6. Windows 路径键、空格路径和 `node.exe` 别名有定向测试。
7. Electron Desktop packaged smoke 或等价启动验证在删除外部 Node PATH 后可以启动内置 Service。
8. TypeScript 影响范围通过 tsc；相关单元/集成测试通过。
9. diff-only maintainability review 无未关闭 findings。

## 十、发布与部署

发布前根据实际依赖图决定载体：

1. 若变更进入 `@nextclaw/core`、`@nextclaw/kernel`、`@nextclaw/server` 和 `nextclaw` 聚合包，发布相应 patch changesets 和稳定 NPM 版本。
2. 构建并部署 stable runtime update channel，使现有 Desktop launcher 能取得新 runtime bundle。
3. 验证 Windows stable Desktop 的 update resolve、bundle 下载、校验、切换和内置个人空间 action smoke。
4. 只有 launcher 本身需要变化或现有 launcher 不能承载新 runtime 时，才发布新的 Desktop installer/GitHub Release；否则不制造无必要 launcher release。
5. 内置个人空间随 runtime bundle 分发，不单独发布 Marketplace artifact；若发布拓扑实证不符，再按事实追加 Marketplace 更新。

发布完成标准不是“npm publish 成功”，而是 Windows Desktop 从用户可用更新通道取得修复后，能在无系统 Node 环境调用收藏和日历。

## 十一、非目标

- 不新增 Python、Bun、Deno 的宿主管理运行时。
- 不给 Service App 增加 OS 级沙箱；现有 `native-process/full-user` 安全语义不变。
- 不把 Service Actions 默认投射给 Agent。
- 不重做 Marketplace 多平台 artifact 模型。
- 不迁移个人空间数据格式。
- 不在本次强制引入新的 typed executor manifest；只冻结未来演进方向。
