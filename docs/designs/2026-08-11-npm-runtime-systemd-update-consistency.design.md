# npm runtime 与 systemd 更新一致性设计

## 1. 问题与证据

VPS `8.219.57.52` 在设置页完成更新操作后出现了三个互相冲突的事实：

- 正在运行的产品进程仍为 `0.30.0`，`/api/app/meta` 因而继续返回 `0.30.0`。
- npm runtime 的 `current` pointer 已切到 `0.31.0`，更新状态因而显示当前内核为 `0.31.0`。
- systemd 的 `ExecStart` 直接指向全局包内的 `dist/cli/app/index.js`，绕过了会读取 `current` pointer 的稳定 launcher。

旧统一更新设计还同时保留了两种冲突的用户契约：一处写“用户点击更新”完成切换，另一处又要求用户分别点击“下载更新”和“更新”。当前设置页采用了后者，要求用户连续执行下载、应用两个动作；runtime manager 的默认 `run()` 却已经是检查、下载、应用的单次流程。

因此这不是单一版本展示错误，而是三个 owner 漂移：设置页动作契约、运行版本事实源、systemd 启动入口。

## 2. 目标

- 设置页只提供一次“立即更新”操作；下载、验签、安装、切换与重启仍是可观察的内部阶段。
- `currentVersion` 表示实际正在运行的产品版本，不能用已经切换但尚未启动的 pointer 冒充。
- pointer 与运行版本不一致时，更新状态必须持续为 `restart-required`，不能被下一次自动检查覆盖成 `up-to-date`。
- systemd、launchd、Windows Task 等常驻入口始终经过稳定 npm launcher，不能固定到某个 runtime bundle 或全局包内的 app entry。
- systemd 托管进程应用更新后由 systemd 重启，重新经过 launcher 选择新 pointer。
- 不改变 bundle 下载、签名校验、previous/current/candidate、坏版本隔离与回滚合同。

## 3. 单一 owner

### 3.1 用户动作 owner

`RuntimeUpdateManager.updateNow()` 是设置页的一键更新 owner：

```text
update-available
  -> downloadUpdate
  -> downloaded
  -> applyDownloadedUpdate
  -> restart-required / up-to-date
```

若进程在下载后中断，下一次点击从 `downloaded` 继续应用，不重复下载。底层 `downloadUpdate` 和 `applyDownloadedUpdate` API 保留，用于进度、CLI、测试和恢复，不再作为设置页两个并列主按钮。

### 3.2 版本事实 owner

- `runningVersion`：当前进程的 distribution version，是 UI `currentVersion` 的事实源。
- `state.currentVersion`：launcher 当前 pointer 指向的目标版本，只用于启动选择、更新比较与回滚。
- `launcherVersion`：稳定 host 的版本，由 npm launcher 显式传给 runtime child，不能用 bundle 的 distribution version 代替。

当 `runningVersion !== state.currentVersion` 时，snapshot 必须返回：

```text
status = restart-required
currentVersion = runningVersion
requiresRestart = true
```

### 3.3 常驻启动 owner

npm launcher 启动 runtime child 时传递稳定 launcher entrypoint 与 launcher version。常驻服务安装器优先使用该 entrypoint 生成启动项。

Linux systemd unit 额外声明自身为 supervisor，并使用 `Restart=always`。该路径使用独立的 `supervised-process-restart` 语义，不复用 NextClaw 自管后台服务的重启语义。应用更新后 runtime child 延迟退出；launcher 继承退出码并结束，systemd 随即重新启动稳定 launcher。`systemctl stop` 仍属于 systemd 的显式停止，不会因 `Restart=always` 被重新拉起。

普通终端中的 `nextclaw serve` 不声明 supervisor，仍返回持久的 `restart-required` 和手动恢复命令，避免进程自行退出后无人拉起。

## 4. 兼容与迁移

- 旧 launcher 不会传递新增环境变量；runtime 必须回退到现有 distribution/version 与 argv 行为。
- 已有错误 systemd unit 需要一次性把 `ExecStart` 改为稳定 launcher。迁移前备份 unit，启动或健康检查失败时回滚。
- 新字段只通过进程环境在 host 与 child 间传递，不扩展用户配置，不写入会话或 workspace。
- 设置页仍允许独立“检查更新”；自动检查策略不变，自动检查不会自动下载或切换版本。

## 5. 验收

### 5.1 定向自动化

- 设置页在 `update-available` 和 `downloaded` 状态都只显示一个“立即更新”按钮，并调用同一个 manager action。
- manager 从 `update-available` 依次下载、应用；从 `downloaded` 只应用。
- pointer 比运行版本新时，初始化和检查后都保持 `restart-required`，`currentVersion` 为运行版本。
- launcher child 收到稳定 launcher entrypoint/version。
- autostart 从 bundle child 安装时仍生成稳定 launcher 命令。
- systemd unit 带 supervisor 标记并使用 `Restart=always`。

### 5.2 VPS 真实验证

- systemd main process 是稳定 launcher，runtime child 路径位于 `runtime-bundles/versions/<version>`。
- 前端静态页返回 200，公网入口可访问。
- 实际 runtime package、进程路径与页面产品版本一致。
- 更新操作后 PID 发生切换，并从新的 current pointer 启动。
- 执行一次真实任务，确认更新没有只修版本展示而破坏 agent 主链路。
