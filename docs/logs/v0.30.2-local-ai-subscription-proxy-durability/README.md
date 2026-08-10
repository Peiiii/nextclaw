# v0.30.2 本地 AI 订阅代理持久性

## 迭代完成说明

- 修复 `proxy-local-ai-subscriptions` Marketplace skill 只证明“安装当时可用”、不能证明代理后续持续运行的问题。
- 根因是原有 `check` 和 provider 写入脚本只检查配置、模型列表与当次 HTTP 请求；Linux 实际接入时使用 `nohup` 从 NextClaw 工具进程临时启动 CLIProxyAPI，进程仍处于 NextClaw service cgroup，NextClaw OOM/重启后代理被连带终止，但 provider 配置继续保留，最终表现为模型一直等待且本地端口拒绝连接。
- 根因通过目标服务器的 session journal、进程启动命令、systemd/cgroup 状态、`127.0.0.1:8317` 拒绝连接以及 provider 配置残留共同确认；修复直接补齐独立进程托管和 provider 写入门禁，而不是延长重试或再次临时拉起进程。
- 新增 Linux systemd 标准安装路径，unit 固定开机自启、`Restart=on-failure`、独立 cgroup 和受保护的配置/运行用户边界；macOS 继续使用 Homebrew services。
- `check` 现在强制验证 service active、enabled、MainPID 和独立 cgroup；`restart-smoke` 在托管重启后重新执行模型发现与真实 Responses marker。
- `nextclaw-provider.mjs` 在任何 provider API 请求前强制执行 readiness 与 `restart-smoke`，失败时保持 NextClaw provider 配置不变。`nohup`、shell 后台进程和单次端口可达不再构成完成状态。

## 测试/验证/验收方式

- 11 个 Node 定向测试通过，覆盖安全配置、systemd unit 生成、active/enabled/cgroup 检查、托管重启、真实 HTTP marker、provider 写入门禁、失败回滚和 NCP native marker。
- 组装边界测试证明：端点即使可达，只要 systemd 未启用或未运行，provider API 请求数量仍为 0；正常路径必须先完成托管重启与真实 Responses 回复。
- 精确 ESLint、`node --check`、`git diff --check` 和 Marketplace validator 通过；Marketplace validator 为 0 error、0 warning。
- 尚未在真实 Linux systemd 主机上执行新版脚本的端到端安装验收；发布前的确定性合同由隔离 systemctl/HTTP 组装测试覆盖，目标服务器迁移需要单独授权执行。

## 发布/部署方式

- 已执行 Marketplace `skills update`，远端包为 `@nextclaw/proxy-local-ai-subscriptions`，共 8 个发布文件。
- 远端条目校验通过：中英文摘要和描述已更新，`install.kind=marketplace`，Linux systemd 与托管重启门禁可见。
- 已从 `/tmp/nextclaw-marketplace-skill.VopbwY` 隔离安装远端包；安装成功，并确认包含 `scripts/cliproxy-service.mjs`、`Restart=on-failure` 和 `restart-smoke`。
- 未部署或重启用户的 NextClaw/CLIProxyAPI 服务器；当前服务器仍需另行执行 systemd 迁移和真实模型验收。

## 用户/产品视角的验收步骤

1. 从 Marketplace 安装或更新 `@nextclaw/proxy-local-ai-subscriptions`。
2. Linux 上按 skill 引导，以目标普通用户生成配置并完成 OAuth，再由 bundled script 安装 `cliproxyapi.service`；macOS 使用 Homebrew services。
3. 确认 `check` 报告服务 active、enabled；Linux 同时报告独立 cgroup。
4. 运行 `restart-smoke`，确认服务重启后仍能发现模型并精确返回 `NEXTCLAW_PROXY_OK`。
5. 用户同意接入 NextClaw 后执行 provider 脚本；只有上述持久性门禁再次通过，provider 才会被创建或更新。
6. 最后通过 `native + <provider-id>/<raw-model-id>` 的 NCP smoke 收到 `NEXTCLAW_NCP_PROXY_OK`。

## 可维护性总结汇总

- Homebrew/systemd 生命周期统一收敛到 `cliproxy-service.mjs`；`cliproxy.mjs` 只保留命令编排、配置与 HTTP 验收，provider 脚本消费同一持久性入口，没有第二套服务判断。
- 首轮实现触发文件预算告警后完成职责拆分：`cliproxy.mjs` 从 618 行降至 362 行，生命周期 owner 为 228 行；共享的安全文件写入与配置校验复用现有 utils。
- scoped maintainability guard 最终为 0 error、0 warning；因文件职责边界变化执行了主观复核，结论为无可维护性发现。
- 新增文件经过 planned-path preflight；没有新增目录、barrel、无语义 wrapper 或兼容入口，也没有触碰工作区并发存在的 server/UI 改动。

## NPM 包发布记录

- 不涉及 NPM 包发布。
- 本次用户可见变更只通过 NextClaw Marketplace 独立交付，因此未添加 NPM changeset。
