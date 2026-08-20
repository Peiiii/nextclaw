# v0.40.3 Service App 宿主 Node 执行器

## 迭代完成说明

- 根因：Service App manifest 中的 `command: "node"` 被当作普通 PATH 命令直接启动。Electron Desktop 虽然内置 Node runtime，却不附带可由 PATH 发现的独立 `node.exe`；因此 Windows 等未安装系统 Node 的机器会在收藏、日历等内置 Service App 调用时出现 `spawn node ENOENT` 和上游 500。
- 确认方式：复核个人空间内置 Service manifest、MCP stdio 启动链路与 Electron 启动语义，并在清空 PATH 中 Node 的环境下，直接使用 Electron executable + `ELECTRON_RUN_AS_NODE=1` 跑通个人空间收藏与日历 action。
- 根因修复：把 `node` / `node.exe` 定义为 NextClaw 宿主 Node 别名，由 core 唯一解析 owner 映射到 `process.execPath`；Electron 宿主只在该别名下注入 `ELECTRON_RUN_AS_NODE=1`。自定义系统命令、包内相对命令和 native `launch.targets` 保持原合同，不增加隐式 fallback。
- Service App 运行失败由 kernel 归一化为 `SERVICE_APP_RUNTIME_FAILED`，server 返回结构化 502 JSON，避免 Hono 暴露 HTML 或裸 `Internal Server Error`。
- 内置个人空间仍是 runtime resource，不创建重复 Marketplace artifact；收藏和日历继续共享一个零依赖 Service 进程与数据目录。

## 测试/验证/验收方式

- `@nextclaw/core`、`@nextclaw/kernel`、`@nextclaw/server` TypeScript 检查通过。
- 定向 ESLint 通过。
- core command resolver 19 项测试、kernel Service/App Package 27 项测试、extension runtime 13 项测试、server controller 9 项测试通过。
- 无系统 Node 的 Electron Node-mode 真实链路：个人空间安装、收藏 save/list、日历 create/list 全部通过，共 27 项。
- `pnpm dev:verify-update` 隔离验证通过：`0.40.1-dev.0` 下载并切换到候选 `0.40.1`，进程重启、UI 自动重连、内置资源可用。
- `pnpm lint:new-code:governance`、`pnpm check:governance-backlog-ratchet` 和 diff-only maintainability guard 通过。

## 发布/部署方式

- 使用仓库 stable NPM release flow 发布受 changeset 影响的包。
- 使用 stable runtime channel 发布四平台 runtime bundle、签名 manifest 与 GitHub Release assets。
- 不重发 Desktop installer：本次未修改 launcher，已安装 Desktop 通过 runtime channel 获得修复。
- 不单独发布 Marketplace：个人空间是 NextClaw 内置 runtime resource。

## 用户/产品视角的验收步骤

1. 在未安装系统 Node 的 Windows Desktop 上升级到包含本修复的 stable runtime。
2. 打开个人空间中的“收藏”，保存链接并刷新，确认可以原地读取。
3. 打开“日历”，创建日程并刷新，确认可以原地读取。
4. 确认不再出现 `Non-JSON response (500)` 或 `spawn node ENOENT`。
5. 对一个声明 native `launch.targets` 的 App 运行平台选择与 action 调用，确认仍使用目标 artifact。

## 可维护性总结汇总

- 新增的命令解析只位于 core 单一 owner，extension runtime 与 Service App runtime 复用，不保留平行特判。
- Review 首轮发现两个已达预算文件继续增长；返工后将 Service App 领域错误移入独立 error owner，`ServiceAppManager` 从 600 行降到 594 行，extension lifecycle 从 658 行降到 657 行。
- 自动 guard 最终 0 error；剩余 warning 是既有超大 extension 文件与接近预算的测试文件，本次未恶化生产文件预算。
- 新增设计、utility 和迭代路径均通过 planned-path preflight，owner 与目录角色符合治理合同。

## NPM 包发布记录

- 需要发布：是。修复必须进入 NextClaw Desktop 可拉取的稳定 runtime，而 runtime bundle 来自已发布的 NPM package batch。
- `@nextclaw/core`：待统一发布。
- `@nextclaw/kernel`：待统一发布。
- `@nextclaw/server`：待统一发布。
- 因内部依赖升级而被 changesets 级联 bump 的 public packages：待统一发布，以 stable release plan 为准。
- `nextclaw` 与 stable runtime channel：待统一发布并完成公开更新链路验证。
