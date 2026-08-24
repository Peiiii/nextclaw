# Desktop Release 公开原子性设计

## 文档状态

- 日期：2026-08-25
- 风险：L4（公开 Release、跨平台安装资产、更新通道与恢复）
- 状态：Design Ready
- 触发证据：`v0.42.3-desktop.1` 至 `.4` 在平台构建或冒烟失败后仍保持公开，四个 Release 的资产数均为 0。

## 一、用户可观察问题与不变量

当前 `release:desktop:stable` 在远端 preflight 后直接执行 `gh release create`。公开 Release 产生的 `release.published` 事件再触发 `desktop-release.yml` 构建和上传资产。只要任一平台在资产上传前失败，GitHub 就会永久留下只有 Source code、没有安装包的公开空壳。

必须建立以下不变量：

1. 平台构建、安装冒烟或资产完整性验证失败时，GitHub 公开 Release 列表中不存在该版本。
2. Release 从 Draft 变为公开状态之前，installer、portable、bundle、manifest、update metadata 和 public key 的完整集合已经上传并通过精确名称核验。
3. 公开动作不再作为构建触发器；构建由显式 `workflow_dispatch` 触发，避免“为了开始构建而先公开”的循环依赖。
4. 更新通道只能在完整 GitHub Release 已公开后前移，避免 manifest 指向公众尚不可下载的 Draft 资产。
5. `DESKTOP_READY` 仍只在 workflow、Release assets、gh-pages、公开 manifest 和适用 APT 全部闭合后报告；仅公开完整 Release 不等于完整桌面更新通道已经成立。

## 二、owner 与当前链路

- `release-desktop.mjs`：本地发布意图、目标身份、前置验证、Draft 创建、workflow dispatch 和完成等待 owner。
- `desktop-release.yml`：跨平台构建、冒烟、资产上传、Release 公开、update channel 与 APT owner。
- `desktop-release-closure.mjs`：公开资产、workflow 和更新通道最终验证 owner。

当前错误链路：

```text
preflight
  -> 公开 Release
  -> release.published
  -> build/smoke
  -> upload assets
```

目标链路：

```text
local verify + exact-commit platform validation + signing preflight
  -> 创建隐藏 Draft（同一 tag/target/notes）
  -> workflow_dispatch(release_tag, release_notes_url)
  -> 五平台 build/smoke
  -> 上传全部资产到 Draft
  -> 精确资产集合核验
  -> 公开同一 Release
  -> 发布 update channel / APT
  -> 外部 closure
  -> DESKTOP_READY
```

## 三、方案选择

### 方案 A：保留先公开，再在失败时自动删除

拒绝。失败检测和删除之间仍存在用户可见窗口；进程中断、权限故障或取消还会再次留下空壳。它修的是清理，不是发布时序。

### 方案 B：所有平台成功后直接创建公开 Release 并一次上传

比当前方案安全，但创建 Release 与逐个 asset upload 仍是多个 API 请求。上传中途失败仍会短暂或永久暴露不完整公开 Release。

### 方案 C：Draft 暂存资产，完整核验后显式公开

选择。Draft 是 GitHub 原生的未发布状态；构建和上传失败只留下私有恢复现场。公开转换发生在完整资产核验之后，并继续复用同一 release identity，不新增第二套 tag、manifest 或 publisher。

## 四、状态与失败恢复

| 状态 | 对外可见 | 允许动作 | 失败结果 |
| --- | --- | --- | --- |
| `PREFLIGHTED` | 否 | 创建 Draft | 不产生公开 Release |
| `DRAFT_CREATED` | 否 | dispatch、构建、上传 | Draft 可复用或清理 |
| `ASSETS_VERIFIED` | 否 | 将同一 Draft 公开 | 不允许缺资产降级公开 |
| `RELEASE_PUBLISHED` | 是，且下载资产完整 | 推进 update channel / APT | 只恢复未完成投影，不重建 Release identity |
| `DESKTOP_READY` | 是 | 报告完成 | 全部闭合 |

恢复规则：

- build/smoke/upload/asset verification 失败：Release 必须保持 Draft；重试复用该 Draft 或显式删除，不新建公开空壳。
- workflow 被取消：Draft 仍不可见；不得靠 `release.published` 自动重启。
- Release 已公开但 update channel/APT 失败：资产已经完整，使用既有 channel/APT recovery，只恢复投影，不重复创建 tag/Release。
- 旧的公开空壳：先转回 Draft 止血；是否永久删除 tag/Release 作为独立清理动作，不影响新合同。

## 五、实现边界

- `createRelease` 增加 `--draft`，并在创建后验证 `isDraft=true`。
- 本地脚本显式 dispatch `desktop-release.yml`，并按 `workflow_dispatch + exact target SHA` 定位本次 run。
- 删除 `desktop-release.yml` 的 `release.published` 触发器及相关事件分支。
- Actions 在矩阵启动前再次要求目标 Release 为 Draft，手工错误触发也快速失败，不浪费平台构建时间。
- 资产 job 只允许向现有 Draft 上传；上传后复用 closure 的唯一资产合同核验完整集合。
- stable 与 beta 各自全局串行且 `cancel-in-progress: false`，禁止新触发取消正在上传或公开的批次。
- 新增独立公开 job；它只在资产核验成功后执行，并在公开后再次证明 `isDraft=false` 与资产集合不变。
- update channel job 依赖公开 job；APT recovery 保留显式 `publish_linux_apt_only` 路径。
- 不新增长期 token、第二个 workflow、兼容性的公开旧入口或“失败也先发”的 fallback。

## 六、最小充分验收

1. 工作流合同测试证明不存在 `release.published`，只存在显式 dispatch。
2. 合同测试证明 CLI 创建 Draft、随后 dispatch，而不是直接公开。
3. 单元测试覆盖完整 stable/beta 资产集合、缺失资产拒绝、Draft/public 状态不匹配拒绝。
4. YAML 静态解析与 actionlint 通过；相关 Node 测试、lint 和脚本语法检查通过。
5. dry-run 输出必须明确 `draft -> workflow_dispatch -> assets verified -> publish`，且不产生外部写入。
6. 远端止血验证：四个已知 0-asset Release 均不再公开；最新公开 Desktop 仍指向最后一次完整成功版本。
7. 未经新的真实桌面发布授权，不以生产 Release 验证本修复；首次真实发布时必须同时观察 Draft 不公开、失败不公开或成功后资产完整两个时间点。

## 七、抽象审计与非目标

保留现有 CLI、workflow、closure 三个 owner，只补生命周期顺序和共享资产不变量。资产集合函数保护当前真实五平台消费方，具有 Actions 发布前门禁和发布后 closure 两个直接消费者，因此不是未来式抽象。

删除 `release.published` 兼容入口；它没有持久外部调用合同，且正是公开空壳的根因。延后跨 GitHub Release 与 gh-pages 的分布式事务抽象：两者无法真正原子提交，当前按“先保证完整下载 Release，再前移更新指针”维持可预测可用性。

非目标：本次不修复具体 Linux/Windows 冒烟业务错误，不创建新的 Desktop 版本，不发布 NPM，不删除历史 tag，也不把空壳 Draft 当成成功版本。
