# Desktop beta 接收 stable 更新设计

## 问题与成功条件

用户在 Desktop 设置中选择 beta 渠道后，系统只查询 beta manifest。stable 发布只更新 stable manifest，因此即使 stable 版本高于当前安装版本，beta 用户仍会看到“已是最新版本”。

成功条件：

- stable 渠道只消费 stable 更新；
- beta 渠道同时消费 beta 与 stable 更新，并选择版本更高的有效候选；
- manifest 的渠道、平台、架构与签名仍逐个严格校验；
- 任一应查询的渠道源失败时检查失败，不把缺失、损坏或签名错误静默伪装成“已是最新版本”；
- 切换渠道后不复用旧渠道的候选或下载状态。

公网现状证据（2026-08-25）：darwin arm64 的 stable manifest 指向 `0.43.0`，beta manifest 仍指向 `0.22.1`。现有 beta 客户端只解析后者，所以无法发现 `0.43.0`。

## 当前链路与缺口

当前主链路是：

`DesktopLauncherStateStore.channel -> DesktopUpdateSourceService.resolveManifestUrl -> DesktopUpdateCoordinatorService.checkForUpdates -> DesktopUpdateService.checkForUpdate -> DesktopUpdateManifest`

`DesktopUpdateSourceService` 将一个渠道映射为一个 URL，`DesktopUpdateService` 又要求 manifest 渠道与已选渠道完全相等。这个模型把“用户选择的更新策略”和“manifest 自身的发布渠道”错误地当成同一个值，无法表达 beta 是 stable 与 beta 的上位集合。

这是更新能力面的局部合同缺口，不需要改变持久化状态、UI 入口、下载或应用生命周期。

## 候选与选择

### 方案 A：stable 发布时覆盖 beta manifest

旧客户端无需修改，但 stable manifest 的签名包含 `channel`，不能直接复制；发布端必须额外生成和签名 beta 投影，还要避免较旧 stable 覆盖较新 beta。渠道选择逻辑会被分散到发布 workflow，且历史安装仍依赖每次发布正确维护双投影。

### 方案 B：beta 客户端聚合两个已签名源（选择）

`DesktopUpdateSourceService` 根据用户策略返回明确的 manifest source 列表：stable 返回 stable；beta 返回 beta 与 stable。`DesktopUpdateService` 逐个按 source 声明的渠道验证 manifest，随后由更新 owner 选出版本最高的结果。

选择该方案，因为两个发布渠道继续各自拥有唯一、原生签名的 manifest；beta 的“包含 stable”语义由客户端更新 owner 一次性表达，不复制发布状态，也不引入新 service、配置或持久字段。

代价是已经安装且尚未具备聚合逻辑的 beta 客户端不能仅靠本次源码修改自举到当前 stable，需要后续通过一次 beta 发布或签名渠道恢复动作获得新逻辑。该外部发布动作不属于本次未授权实现范围。

## 冻结合同

- 新增轻量 `DesktopUpdateManifestSource` 值对象，只包含 manifest 自身的 `channel` 与 `url`；不新增 resolver/provider 抽象。
- `DesktopUpdateSourceService.resolveManifestSources()` 是用户渠道策略到候选源集合的唯一 owner：
  - stable -> `[stable]`
  - beta -> `[beta, stable]`
  - 显式 `NEXTCLAW_DESKTOP_UPDATE_MANIFEST_URL` -> 仅该 URL，并以当前用户渠道为预期 manifest 渠道，保持显式测试/诊断覆盖语义。
- `DesktopUpdateService.checkForUpdates(sources, currentVersion)` 并行读取并严格验证全部 source；每个 manifest 必须匹配 source 的渠道及当前平台、架构和签名。
- 先按版本选择最高 manifest，再应用 launcher floor、坏版本隔离和 current-version 判断，避免较低渠道候选的阻断状态盖过更高候选。
- 同版本候选优先 stable，使正式版本在与同基线 beta 并存时成为规范结果。
- 任一 source 请求或验证失败时整体失败。这里没有 fallback：beta 的两个 source 都是主合同的一部分，不能静默掩盖发布或签名缺陷。
- 现有单 URL `resolveManifestUrl()` 与单 manifest `checkForUpdate()` 只保留给初始 bundle bootstrap 和局部测试；常规更新检查不得在 coordinator 外自行拼候选集合。

## 用户可见状态

| 场景 | 用户结果 | owner | 失败行为 |
| --- | --- | --- | --- |
| stable 检查 | 只看到更新的 stable | source service + update service | stable 源失败则检查失败 |
| beta 检查，stable 更新更高 | 看到 stable 更新 | source service + update service | 任一主合同源失败则检查失败 |
| beta 检查，beta 更新更高 | 看到 beta 更新 | source service + update service | 任一主合同源失败则检查失败 |
| beta/stable 均不高于当前版本 | 显示已是最新 | update service | 不适用 |
| 切换渠道 | 清空旧候选/下载并按新策略重查 | update coordinator | 沿既有失败状态处理 |

## 抽象审计与边界

命中的原则是 information expert、single-complete-owner、simple-structure-first 与 fail-fast。新增 source 值对象保护“manifest 按自身渠道验证”的安全不变量；批量检查方法消除 coordinator 逐源拼装与选优逻辑。除此之外不新增 manager、registry、fallback、配置或状态。

不修改发布 workflow，不改 manifest 格式和签名载荷，不改变 stable 渠道语义，不新增自动下载或自动应用行为。旧单源入口服务初始 bootstrap，当前有真实调用者，暂不删除。

## 最小验证

- source service 单测证明 stable 返回一个源、beta 返回 beta + stable、显式 URL 保持单源覆盖；
- update service 单测证明 beta 能选中更高 stable、能保留更高 beta、stable 不接受 beta、源渠道/签名/平台/架构错误 fail-fast；
- coordinator 单测证明 beta 检查把更高 stable 映射为 `update-available`；
- 运行 Desktop 范围 TypeScript 检查和定向测试。
