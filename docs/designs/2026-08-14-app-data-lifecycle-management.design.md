# NextClaw App 数据生命周期管理设计

- 日期：2026-08-14
- 状态：冻结，完成设计自审
- 风险等级：L4
- 目标版本：NextClaw v0.36.0
- 产品 owner：`@nextclaw/kernel` App Data Manager
- 文件事务 owner：`@nextclaw/app-runtime` App Instance Storage
- 适用范围：正式 App Package、保留的 App Instance、Workspace Service App、开发态 Service App 的数据说明与清理入口

## 1. 结论

NextClaw 已经把正式 App 的代码和数据分开，并支持“卸载时保留数据”与“卸载时同时删除数据”。当前缺口不在基础目录，而在完整生命周期：用户选择保留后无法再次找到并删除残留数据；卸载确认没有列出实际删除范围；Workspace Service 删除源码后会留下不可见实例；开发态数据缺少明确重置入口；UI、CLI、USAGE、runtime README 与内建 Skill 没有共享同一份产品语义。

本设计采用一条统一主链：

1. App Instance metadata 是私有数据身份事实，registry/source 只决定它当前是“使用中”还是“已保留”。
2. app-runtime 只负责在受管根目录中发现、计量、暂存、删除和恢复实例目录，不决定产品是否允许删除。
3. kernel `AppDataManager` 统一投影正式 Package 与 Workspace Service 的数据清单并拥有残留数据删除资格；Package/Service 原生命周期 owner 继续负责停止 runtime、撤销 grant 与移除代码。
4. Apps 页面同时展示已安装 App 和“已保留的应用数据”；保留后仍可独立删除，不要求重新安装。
5. 卸载/删除确认必须展示 App 身份、发布者、实际路径、总大小以及 data/config/state/cache/tmp/logs 分项大小。
6. “删除 App 私有数据”只删除受管 Instance Container；用户显式选择的外部文档、导出文件和 workspace 普通文件永远不在删除范围。
7. `nextclaw app data list|delete` 是 NextClaw 用户/Agent 的统一 CLI；`napp uninstall --purge-data` 保持低层安装事务兼容，不再新增第二套普通用户数据命令。
8. 开发态 Service 使用 `nextclaw app dev --reset-data --confirm <app-id>` 在启动前显式重置当前源码身份对应的开发实例；开发数据不混入普通用户的 Apps 数据清单。

## 2. 用户任务与成功条件

### 2.1 核心用户任务

用户从 Apps 进入，希望在卸载前知道“会删什么、占多少空间”，可以安全选择保留或永久删除；如果先保留，之后仍能在同一页面找到残留数据并独立删除，完成后看到条目消失且真实目录不存在。

### 2.2 成功条件

- 正式 App 卸载对话框展示六类目录大小、总大小和数据路径。
- 默认仍为保留数据；永久删除需要显式选择，文案明确不可撤销。
- 保留卸载后，Apps 页面出现“已保留的应用数据”，刷新/重启后仍可见。
- 删除已保留数据后，实例目录、metadata 和对应条目同时消失。
- 已安装或正在被 Workspace Service 使用的数据不能通过“残留数据删除”接口绕过卸载/停用链路。
- Workspace Service 删除时提供保留/删除选择；保留后进入统一残留清单。
- 开发者能用 `nextclaw app dev <path> --reset-data --confirm <app-id>` 重置稳定开发实例，不手工猜目录。
- CLI、HTTP、client SDK、UI、双份 USAGE、app-runtime README 和 `nextclaw-self-manage` Skill 语义一致。
- 删除事务在 registry/source 状态变化、文件删除失败或并发操作时显式失败，不留下半删除状态。

## 3. 当前事实与缺口

| 链路 | 当前事实 | 缺口 |
| --- | --- | --- |
| 正式 Package | `~/.nextclaw/apps/instances/<app-id>/default`；卸载支持 `purgeData` | 保留后 registry 消失，UI/CLI 无法再次发现和删除 |
| 卸载 UI | 默认保留、可选择同时删除；卡片显示总大小与 data 路径 | 确认框没有分项大小，未列出 instance container 完整范围 |
| app-runtime | metadata 绑定 app/instance/publisher；删除使用 staging + rollback | 没有只读 inventory 与独立 retained purge 公共入口 |
| Workspace Service | `<workspace>/.nextclaw/app-instances/<service-id>/default` | 删除源码目录时不询问数据策略，实例变成不可见残留 |
| 开发态 Service | `~/.nextclaw/apps/dev-instances/<app-id>/<source-hash>/default` | 稳定但无显式 reset；不能要求开发者手工删除 hash 目录 |
| grants | Package 卸载会移除 Panel 状态和 Service grants | 残留数据删除不能误删外部用户资产，也不能恢复已撤销 grant |
| 文档/Skill | 设计稿存在，CLI 已有 `--purge-data` | app-runtime README 仍写旧 data 路径；USAGE 与 Skill 未覆盖数据管理 |

## 4. 典型产品原则

### 4.1 Android / Chrome：App 私有数据与用户资产分离

Android 和 Chrome Extension 默认在卸载时移除 app-specific/local storage，但用户期望独立存在的共享文件不能放进 App 私有容器。可迁移原则是“删除范围必须由存储 owner 决定，用户资产不跟随私有容器删除”，不是照搬默认删除策略。

- https://developer.android.com/training/data-storage/app-specific
- https://developer.chrome.com/docs/extensions/reference/api/storage

### 4.2 Flatpak：代码删除与数据删除是两个显式决定

Flatpak 普通卸载保留 `~/.var/app`，`--delete-data` 才删除 App 数据与 permission store。NextClaw 的个人笔记、待办和收藏具有较高误删成本，因此沿用“默认保留、显式 purge”，但补齐保留数据的后续管理入口。

- https://manpages.debian.org/unstable/flatpak/flatpak-uninstall.1.en.html

### 4.3 VS Code / XDG：按 scope 与生命周期分类

VS Code 区分 workspace/global storage、state、logs 和 secrets；XDG 区分 data/config/state/cache/runtime。NextClaw 保持 data/config/state/cache/tmp/logs 分类，并让 UI 展示真实分项，而不是把所有内容统称为“数据”。

- https://code.visualstudio.com/api/extension-capabilities/common-capabilities
- https://specifications.freedesktop.org/basedir/

## 5. 候选方案

### 5.1 方案 A：只完善卸载确认框

增加分项大小和警告，但不处理保留后的残留发现。

否决：解决了第一次选择，却没有闭合“以后再删除”的主任务；Workspace Service 和 Skill 仍然分裂。

### 5.2 方案 B：UI 扫描文件系统并直接删除

前端请求一个通用文件删除 API，按路径列出残留。

否决：路径成为客户端输入，容易越出受管根；UI 获得产品和文件事务双重 owner；CLI/Agent 仍要再造逻辑。

### 5.3 方案 C：kernel 统一 App Data Manager + app-runtime 文件事务

app-runtime 从受管 root 推导路径并执行只读 inventory/usage 和 staged purge；kernel 合并 Package/Workspace 生命周期并暴露统一 view/action；UI、CLI、Skill 只消费同一合同。

优点：owner 清楚、删除资格唯一、可覆盖刷新/重启/残留、路径不可伪造、验证可从 UI 一路落到真实文件。

代价：涉及 app-runtime、kernel、server、client、UI、NextClaw CLI 与文档，多包发布。

结论：采用方案 C。

### 5.4 方案 D：立即引入 SQLite 数据目录注册表

否决：metadata 文件已经是可恢复事实；当前主要问题是发现和产品语义，而不是查询性能。引入本地 DB 会扩大打包、迁移和跨平台风险。

## 6. 统一领域模型

### 6.1 AppDataEntry

```ts
type AppDataSource = "package" | "workspace-service";
type AppDataLifecycle = "active" | "retained";

type AppDataEntry = {
  id: string; // host 生成的稳定 opaque id，客户端不能拼路径
  appId: string;
  instanceId: string;
  publisherId?: string;
  displayName: string;
  source: AppDataSource;
  lifecycle: AppDataLifecycle;
  storage: AppStorageContext;
  usage: AppStorageUsage;
  createdAt: string;
  migratedAt?: string;
  actions: {
    deleteRetainedData: boolean;
  };
};
```

不新增第二份持久化 catalog。Entry 由 metadata + 当前 registry/source 快照投影：

- metadata 存在且 registry/source 存在：`active`；
- metadata 存在且 registry/source 不存在：`retained`；
- registry/source 存在但 metadata 不存在：由原 owner 的显式 materialize action 创建，list 不产生副作用。

### 6.2 ID 与路径安全

- Package ID 只编码 `package + appId + instanceId`。
- Workspace Service ID 只编码当前 workspace identity + service id + instance id。
- 服务端解析 ID 后按受管 root 重新推导路径，并重新读取 metadata 验证 app/instance/publisher。
- 客户端提交的 `storage.dataDirectory`、`instanceDirectory` 或任意绝对路径永远不参与删除。
- 所有 list/get/status 纯读；App Data 清单直接读取已有 registry/source 快照，不触发 built-in bootstrap 或实例 materialize；materialize、purge、reset 是显式 action。

## 7. Owner 与依赖边界

### 7.1 app-runtime

新增 `AppInstanceInventoryService`：

- 扫描一个明确传入的受管 instance root；
- 只接受 `<app-id>/<instance-id>/metadata.json` 标准布局；
- 返回 metadata、重新推导的 storage context 和 usage；
- 对坏 metadata 返回可观察诊断，不静默跳成可删除 entry；
- purge 使用 instance lock，先 rename 到 `.deleting-<uuid>`，完成上层状态确认后删除；失败恢复原路径。

现有 `AppInstanceStorageService` 继续拥有 materialize/migrate/usage；不把 inventory、purge 和 materialize 混成一个副作用不清的 read API。

### 7.2 kernel

新增 `AppDataManager`，直接依赖：

- Package installation data owner；
- Workspace Service data owner；
- app-runtime inventory transaction。

职责：

- 合并并排序 AppDataEntry；
- 根据 registry/source 快照计算 active/retained；
- 只允许 retained entry 走独立 delete；
- Package/Workspace active 数据分别要求走 uninstall/delete-service 主链；
- 删除事务成功返回前确认 canonical instance 已移除；调用方随后重新读取 inventory，证明 entry 和目录都消失。

不让 server/controller 组合文件路径，不新增 manager→manager 的同名透传层。

### 7.3 transport 与 consumer

- HTTP：`GET /api/app-data`、`DELETE /api/app-data/:dataId`。
- 删除 body 必须带 `confirmAppId`；不匹配返回 409/400。
- client SDK：`appData.list()`、`appData.deleteRetained(dataId, confirmAppId)`。
- UI：独立 `features/app-data` 公共入口拥有 data query、usage 与 retained 管理组件；Apps 与 Service Apps 只消费该入口，避免反向依赖和循环；retained section 只显示 retained entries。
- CLI：`nextclaw app data list --json`、`nextclaw app data delete <data-id> --confirm <app-id> --json`，通过本地 API 使用同一 kernel owner。

## 8. 用户体验与功能地图

| 场景 | 用户看到什么 | 动作 | owner | 失败/返回 |
| --- | --- | --- | --- | --- |
| Apps 默认态 | 已安装 App；有残留时显示“已保留的应用数据” | 管理、卸载、删除残留 | AppDataManager | data query 失败独立提示，不遮挡已安装 App |
| 卸载 | 保留/删除两项；路径、总量、六类分项 | 取消或卸载 | AppPackageManager | 失败保持对话结果可解释，代码/数据恢复 |
| 保留卸载完成 | App 从安装列表消失，残留条目出现 | 以后删除 | AppDataManager | 刷新/重启后结果一致 |
| 删除残留 | App/publisher/path/分项大小、不可恢复提示 | 取消或永久删除 | AppDataManager | identity/状态变化时拒绝，不能删除新安装数据 |
| Workspace Service 删除 | 保留/删除数据选择与分项大小 | 删除 source | ServiceAppManager | source/data 任一步失败按事务恢复或明确报告 |
| 空态 | 没有残留时不展示管理区 | 无 | UI | 不制造“0 B 数据”噪声 |
| CLI/Agent | 机器可读 entry、allowed action、明确 confirm | list/delete | AppDataManager | status/API 不可用时 fail-fast，不猜端口和路径 |

交互约束：

- 默认焦点和默认选择保持“保留个人数据”。
- 永久删除使用 destructive 视觉，按钮写“永久删除数据”，不复用含糊的“确定”。
- 确认内容至少显示 app id；publisher 有值时同时显示。
- 不要求用户输入随机确认词，但 CLI 必须显式提供 `--confirm <app-id>`；GUI 的显式 destructive choice + 最终按钮形成两步决定。
- 危险操作只能由明确按钮触发，残留数据卡片本身不可点击删除，也不嵌套按钮或链接。
- 永久删除对话框初始焦点落在“取消”而不是 destructive action；提交前允许 Escape/取消，提交后禁用重复提交和关闭并显示进行中状态。
- 删除失败时保留对话框、路径和大小上下文，聚焦错误摘要；成功后给出可感知反馈，并把焦点返回残留区标题或下一条记录。
- 路径可选择、复制和查看，但不是删除参数；只读路径控件仍支持键盘访问。
- 清单加载、局部错误和空态各自独立；清单失败不遮挡已安装 App，屏幕阅读器能感知删除成功与失败状态。

## 9. 生命周期与失败恢复

### 9.1 Package 卸载并保留

1. 停止 Panel/Service runtime。
2. 撤销运行 grants 和组件投影。
3. 确保 legacy data 已迁入 instance container。
4. staging 所有 package version，删除 registry installation。
5. 删除 staging package；保留 instance metadata 与 publisher binding。
6. AppDataManager 下一次纯读 inventory 将其投影为 retained。

### 9.2 Package 卸载并删除

保持现有 installation transaction：package 与 instance 一起 staging；registry 删除成功后清理 staging；失败按逆序恢复。返回 `dataRemoved: true` 只能在受管 instance 已不可达后成立。

### 9.3 独立删除 retained data

1. 读取 dataId 并重新推导路径。
2. 获取 instance lock。
3. 再读 registry/source；如果已重新安装或重新出现，返回 conflict。
4. 验证 `confirmAppId`、metadata identity 与 publisher binding。
5. rename 为 `.deleting-<uuid>`。
6. rename 成功即让 canonical path 不可见，再递归删除 staging。
7. 递归删除失败时优先把 staging 恢复成 canonical path；恢复也失败则抛出聚合错误，后续 inventory 把异常 staging 作为诊断暴露，不自动删除未知目录。

不会为了“看起来成功”静默忽略删除错误；不会删除未知 metadata、未知布局或 root 外路径。

### 9.4 Workspace Service

- 删除 source 与处理 instance 必须是一个产品操作，但数据选择仍由用户决定。
- 保留时先停止 runtime、删除 source、撤销 grants，instance 留在 workspace root 并投影为 retained。
- 删除时 source 和 instance 都先 staging；任何 registry/source 操作失败时恢复。
- Package-managed Service 继续拒绝从 Service Apps 单独删除，必须回到 Apps 管理整个 Package。

### 9.5 开发态

- `nextclaw app dev --reset-data --confirm <app-id>` 只针对传入源码路径哈希推导的精确 dev instance；manifest app id 与 confirm 不一致时在任何删除前失败。
- reset 在启动 runtime 前执行；若目标目录 metadata identity 不匹配则拒绝。
- 普通 Apps inventory 不扫描 `dev-instances`，避免把开发残留当作用户 App 数据。
- 本期不增加后台自动清理；开发数据删除是显式 action。

## 10. 兼容与迁移

- 旧 `~/.nextclaw/apps/data/<app-id>` 仍只在既有 materialize 主链中一次性迁移；inventory 不长期兼容扫描旧目录，避免双 owner。
- 已发布 `napp uninstall <id> [--purge-data]` 保持行为和默认值不变。
- 新 HTTP/CLI 是增量公共入口，不保留临时别名。
- 当前 metadata schemaVersion 1 足以表达 inventory identity，不为本功能制造 schema v2。
- app-runtime README 的当前布局只写 instance container；旧 data 路径仅能出现在明确标注的一次性迁移说明中。

## 11. 文档与 Skill 同步矩阵

| Surface | 必须更新 |
| --- | --- |
| 正式设计 | 本文档；原 v0.35.0 设计链接到本设计作为生命周期补充 |
| app-runtime README | 新目录布局、保留/删除语义、`--purge-data` |
| `docs/USAGE.md` | App 安装、数据查看、卸载和 retained delete 用户命令 |
| packaged `resources/USAGE.md` | 由同步脚本生成；除生成提示头外，正文与 docs 完全同步 |
| `nextclaw-self-manage` Skill | App data intent、命令、破坏性确认与验证步骤 |
| 用户文档站 | 双语 App 数据与卸载说明、v0.36.0 release notes |
| UI i18n | 中英文分项大小、残留、删除确认、错误与完成反馈 |

触达 NextClaw 自管理命令后，三份 owner（docs USAGE、packaged USAGE、built-in Skill）缺一不可；发布 tarball 必须验证 packaged guide 与 Skill 均存在最新命令。

## 12. 验证标准

### 12.1 app-runtime

- inventory 只发现标准 metadata；坏 metadata 可观察、root 外路径不可注入。
- 分项 usage 与真实文件字节一致。
- retained purge 成功删除 canonical instance；模拟上层失败时恢复；并发 materialize/purge 串行化。
- legacy migration 后 inventory 只返回 instance-v1。

### 12.2 kernel/server/client

- active/retained 状态在安装、保留卸载、重装、独立删除之间正确转换。
- 同 publisher 重装复用；不同 publisher 仍拒绝接管。
- active data 独立 delete 返回 conflict。
- Package 和 Workspace Service 都通过同一 AppData list/delete HTTP 合同。
- server 参数验证、client request body、错误码和公开类型一致。

### 12.3 UI

- 卸载对话框显示总量、六类分项和路径。
- 默认保留；选择删除后 destructive 文案与 mutation `purgeData: true` 一致。
- 保留卸载完成后 retained section 出现；永久删除完成后消失。
- retained query 错误不阻断已安装 Apps；窄布局和键盘操作正常。

### 12.4 CLI/Skill/docs

- `nextclaw app data list --json` 读取本地 API；delete 缺少/错误 confirm 时 fail-fast。
- `nextclaw app dev --reset-data --confirm <app-id>` 只删除当前源码 identity 的 dev instance。
- docs USAGE 与 packaged USAGE 的正文一致，packaged 文件只额外包含生成提示头。
- built-in Skill 能把“查看/删除 App 数据”路由到已记录命令，不建议手工 `rm -rf`。
- app-runtime README、CLI help、HTTP types 和 UI 文案不再把旧 data layout 描述为当前布局。

### 12.5 真实纵向验收

1. 安装真实 `.napp`，写入六类目录中的可识别文件。
2. UI/API/CLI inventory 核对路径与分项字节。
3. 保留卸载，确认代码消失、数据保留、retained entry 出现。
4. 重启/重新实例化 kernel，确认 entry 仍存在。
5. 独立删除 retained entry，确认目录与 entry 消失。
6. 模拟删除期间状态变化，确认 active 数据未被误删。
7. Workspace Service 分别走保留与删除路径。
8. dev `--reset-data --confirm <app-id>` 验证旧 sentinel 消失，新 runtime 使用同一稳定路径重新创建空目录。

## 13. 非目标

- 本期不增加云同步、自动备份或跨设备恢复。
- 本期不承诺现代文件系统上的“法证级安全擦除”；产品语义是永久移除 NextClaw 受管引用和文件。
- 本期不开放多实例创建 UI，但 inventory 与 ID 保留 instanceId。
- 本期不把外部用户文档复制进 App container，也不随 purge 删除它们。
- 本期不实现 Secret Broker；未来 secrets 生命周期必须独立于普通目录并在 purge 合同中另行冻结。
- 本期不自动清理 retained 数据；个人持久数据没有 TTL。

## 14. 设计自审

### 14.1 覆盖性

- 覆盖第一次卸载、保留后再删除、刷新/重启、重装、发布者冲突、Workspace Service、开发态重置、CLI/API/UI/Skill/docs。
- 覆盖正常、空、错误、并发和状态变化；没有用“以后再补”掩盖用户主路径。

### 14.2 Owner

- metadata/文件事务归 app-runtime；产品资格和跨入口投影归 kernel；transport 不拼路径；UI/CLI 不复制删除规则。
- 没有新增第二份持久 catalog、通用 path delete API或同名 manager 转发链。

### 14.3 安全与可恢复性

- 删除目标只从受管 root + identity 推导；active/retained 在锁内重检；破坏性动作显式确认；失败不静默成功。
- 外部用户资产和未知布局明确排除。

### 14.4 可交付性

- 方案可以在现有 JSON/metadata、AppRegistry、ServiceAppManager 和 HTTP/client/UI 结构上单路径实现。
- 最小充分验证从 unit 到真实 `.napp` 文件链路明确；版本为用户可见 minor `0.36.0`，Desktop 不因本功能自动进入发布范围。

自审结论：设计足以进入实现；若实现发现 Workspace Service source/data 无法形成可恢复双目录事务，则返回 Design 调整，不允许降级为静默残留。
