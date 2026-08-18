# Panel App 稳定资源恢复设计

日期：2026-08-18

相关文档：

- [NextClaw 产品愿景](../VISION.md)
- [Single HTML Panel Apps Design](./2026-05-26-single-html-panel-apps-design.md)
- [Native App Platform Artifacts Design](./2026-08-18-native-app-platform-artifacts.design.md)

## 1. 背景与设计缺失

Marketplace 安装的 Panel App 可以从 Apps 列表正常打开，但固定到右侧边栏后再次打开会显示：

```json
{"ok":false,"error":{"code":"PANEL_APP_NOT_FOUND","message":"panel app not found"}}
```

这不是 Rust Service App 的运行时故障，而是 Panel App 资源身份与来源解析合同缺失：

- Apps 列表返回的 `contentPath` 携带当前安装目录的绝对 `path`，首次打开因此成功。
- 右侧面板的 canonical `resourceUri` 只保存 `entry.id`，没有保存该 `path`。
- 固定项持久化后按 `resourceUri` 恢复；服务端无 `path` 时只按 workspace Panel App 查找，没有回落到当前启用的 Marketplace package component。
- 404 JSON 被 iframe 直接展示，用户看不到可理解的恢复动作。

原有设计覆盖了 workspace 文件发现、受控内容 API 和右侧面板打开，却没有覆盖 Marketplace 来源、固定、刷新、升级、卸载和重装组成的完整生命周期。这属于一个“Panel App 稳定资源寻址”能力面的设计缺失，不应只在固定按钮处补一个安装路径。

## 2. 用户任务与成功标准

用户从 Apps 列表打开一个当前可用的 Panel App，将其固定到右侧边栏；之后刷新页面、关闭再打开、升级或重装同一个 App，固定入口仍应按稳定逻辑身份打开当前启用版本，而不是依赖历史安装目录。

成功标准：

1. workspace 和 Marketplace Panel App 都能通过同一 canonical URI 打开。
2. 固定项不持久化绝对安装路径、版本目录或临时 runtime token。
3. App 升级或同 ID 重装后，旧固定项自动指向当前启用来源。
4. App 已卸载或禁用时，返回明确的 not-found 状态；不得静默打开旧版本文件。
5. 现有带 `path` 的临时/外部 Panel App 入口继续工作，但不成为 Marketplace 的标准恢复路径。

## 3. 现有 owner 与约束

- Panel App 的逻辑身份来自 panel manifest 的 `id`，Marketplace component 也持有稳定 component `id`。
- `PanelAppPackageStateManager` 已拥有 workspace 与 active package source 的合并和冲突检查，应继续作为来源解析 owner。
- `PanelAppManager` 拥有内容读取、bridge 注入与响应语义；server controller 只做 HTTP 映射。
- DocBrowser 与 Side Dock 只持有资源引用和界面状态，不应理解安装目录、版本选择或 Marketplace registry。
- Side Dock 使用浏览器 localStorage 持久化，现有固定项不能依赖一次性内存迁移才能恢复。

## 4. 方案比较

### 方案 A：固定项继续保存绝对 `sourcePath`

实现最小，但路径会随升级、回滚、迁移和清理失效，也把 kernel 的安装布局泄漏给 UI。更严重的是，卸载后只要旧目录残留就可能继续打开不再启用的代码。拒绝。

### 方案 B：固定项打开前重新请求 Apps 列表并拼接 `contentPath`

可以避免保存路径，但把 package source 选择复制到前端；所有 canonical URI consumer（固定项、聊天引用、历史记录、未来书签）都要各自补一次目录查询。网络竞态和错误语义也会扩散。拒绝。

### 方案 C：稳定 Panel App ID + kernel 当前来源解析

固定项只保存 `nextclaw://panel-app/<stable-app-id>`。打开时统一映射到 `/api/panel-apps/<stable-app-id>/content`，kernel 先解析 workspace source，再解析当前启用的 package component；安装路径只存在于 kernel 的当前 package state 中。升级、回滚和重装天然重新绑定到当前来源。

这是推荐方案。代价是需要同时修正 UI producer 与 kernel resolver，并覆盖旧 `entry.id` 固定项，但它建立了所有资源消费者都能复用的单一合同。

## 5. 冻结设计

### 5.1 Canonical 资源身份

标准 URI：

```text
nextclaw://panel-app/<panel-app-id>
```

其中 `<panel-app-id>` 必须是 panel manifest / package component 的稳定逻辑 ID。UI 创建资源目标时使用 `entry.appId`，不能使用文件名派生 ID、安装目录或 package version。

`contentPath` 是当次展示 URL，不是持久化身份。Apps 列表中的 workspace 与 Marketplace 条目都应返回基于稳定 app ID、且不含安装路径的内容 URL。`sourcePath` 只允许用于显式外部或本地临时来源的兼容入口：

```text
nextclaw://panel-app/<id>?path=<absolute-source-path>
```

Marketplace 列表项不得生成这种 canonical URI。

### 5.2 来源解析

无显式 `path` 时，`PanelAppManager` 委托 `PanelAppPackageStateManager` 按当前状态解析：

1. 查找 workspace Panel App 的 source ID 或 manifest app ID。
2. 查找当前启用 package panel component 的 component ID、manifest app ID或旧 source ID。
3. 无匹配时返回 `PANEL_APP_NOT_FOUND`。

有显式 `path` 时维持现有受控绝对路径读取和校验，不把它隐式回退为 package 查找。

workspace 与 active package 的 ID 冲突继续由激活阶段拒绝，因此正常状态下解析结果唯一。controller 不参与来源选择。

### 5.3 固定项与兼容

- 新固定项保存基于 `entry.appId` 的 canonical URI。
- 已保存的旧固定项可能包含文件名派生 `entry.id`；kernel 在读取 active package sources 时兼容 component ID、manifest app ID和 encoded source name，因此不要求清空 localStorage。
- 已带 `path` 的旧固定项继续按显式来源打开；本次不主动重写用户 localStorage。
- 兼容查找只用于资源读取，不形成第二套展示或注册模型；未来固定项自然收敛到稳定 app ID。

### 5.4 生命周期与失败行为

| 场景 | 解析结果 | 用户可见结果 |
| --- | --- | --- |
| 首次打开、固定后重开、页面刷新 | 当前 workspace 或 active package source | 正常加载 |
| 同 ID 升级、回滚、重装 | 当前启用版本 source | 固定项无需变化，加载当前版本 |
| App 禁用或卸载 | 不解析已停用 package source | `PANEL_APP_NOT_FOUND`，不执行旧文件 |
| App 再次启用或重装 | 当前 source 重新出现 | 原固定项恢复可用 |
| 显式外部 path 仍存在 | 指定 source | 按原兼容合同加载 |
| 显式外部 path 已失效 | 无来源 | `PANEL_APP_NOT_FOUND` |

本次先修正寻址正确性。把 iframe 的原始 JSON 替换为产品化错误卡片属于独立的 DocBrowser 错误呈现能力，不用错误 UI 掩盖寻址问题。

## 6. 实现边界

修改：

- UI Panel App resource target 使用 `entry.appId` 生成 dedupe key 和 canonical URI。
- kernel 内容读取无 `path` 时走统一 package-aware resolver。
- package resolver 对新 stable ID 和旧 source ID 都可寻址。
- 增加 UI URI 单测和 kernel package lifecycle 单测。

不修改：

- Side Dock 持久化 schema 和 localStorage key。
- Marketplace manifest schema、安装目录布局或 Service App runtime。
- Panel App 权限、bridge、asset token 合同。
- 全局 DocBrowser 错误页设计。

## 7. 最小验证标准

1. UI 单测证明 `entry.id !== entry.appId` 时仍以 `appId` 生成 canonical URI。
2. kernel 单测证明 package Panel App 不带 `path` 可按 component/app ID 打开。
3. kernel 单测证明旧 source ID 固定项仍能打开当前 package source。
4. kernel 单测证明 package source 被移除后返回 `PANEL_APP_NOT_FOUND`，重新出现后恢复。
5. workspace Panel App、显式外部 path 和 bridge 注入既有测试保持通过。
6. 运行受影响 TypeScript package 的 `tsc`，再进行真实构建/发布前验证。

## 8. 设计缺失的流程沉淀

本次还暴露了开发流程中的规则缺口：虽然现有 lifecycle 规定“模型缺口回到 Design”，但没有说明补设计的范围如何选择。

应在 `development-design` 的条件 reference 中增加“设计缺失范围判定”合同：范围由被破坏的不变量、同类复发面和生命周期跨度决定，而不是由当前代码 diff 大小决定；优先选择能关闭同类问题的最小完整能力面，并明确区分实现偏差、局部合同缺口、能力面缺失和系统模型缺失。该规则只在已有实现、验证或线上问题暴露未建模行为时加载，不新建平行 skill，也不增加 AGENTS 常驻体积。
