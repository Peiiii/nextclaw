# v0.25.17 Agent Browser 内置 Skill

## 迭代完成说明

本迭代把 Agent Browser 从“用户可能另外安装、Agent 未必知道”的 workspace/Marketplace skill，收敛为 NextClaw builtin skill，并补齐 `web_search` 就绪状态与独立浏览器路径的选择合同。

根因是 `web_search` 即使没有配置所选 provider 的 API key 也会出现在工具目录中，失败后只返回普通错误字符串；同时 Agent Browser skill 不在 builtin 层，Native Agent 没有稳定事实源去发现、检查和使用外部 CLI。该结论通过工具注册代码、SkillsLoader 优先级、Marketplace installed-record 和真实 Native 对话共同确认。

修复落在真实 owner：`ToolingContextProvider` 只负责本轮能力状态和选择策略；builtin `agent-browser` skill 负责外部 CLI 的首次检查、授权安装、版本匹配用法、浏览器执行边界和 session 清理。没有在 `web_search` 内制造隐藏 fallback，也没有把 Agent Browser 代码或浏览器二进制打进 NextClaw。

方案文档见 `docs/designs/2026-07-18-agent-browser-builtin-skill.design.md`。

## 测试/验证/验收方式

- `@nextclaw/core`：2 个定向测试文件，12 个用例通过。
- `@nextclaw/kernel`：2 个定向测试文件，4 个用例通过。
- Core 与 Kernel 定向 ESLint 通过。
- Core 与 Kernel `tsc` 通过。
- Core 与 Kernel build 通过；Core dist 中包含 `skills/agent-browser/SKILL.md`，并能从构建产物以 `source=builtin` 加载。
- 当前源码隔离实例完成全量依赖构建并达到 NCP ready；实例在验收后已停止。
- Native + `minimax/MiniMax-M3` 显式 Agent Browser 工具冒烟通过：读取 builtin skill、执行真实浏览、读取标题/URL、关闭命名 session、收到 `run.finished`。
- Native + `minimax/MiniMax-M3` 自动选路冒烟通过：识别 Bocha 未配置，区分 `web_fetch / DevTools MCP / Browser Connector`，自动读取 builtin skill 并调用外部 `agent-browser` CLI。
- `agent-browser doctor --offline --quick`：6 pass / 0 warn / 0 fail；`agent-browser session list`：无活动 session。
- Marketplace installed-record 实测返回 `agent-browser source=builtin, enabled=true`，同名 workspace/Marketplace 副本不会形成第二套安装态。
- scoped maintainability guard：0 error；仅保留 provider 根目录已有且带豁免的 14/14 文件预算 warning，本次没有增加根目录文件数。
- `pnpm check:governance-backlog-ratchet` 与 `git diff --check` 通过。
- 全工作区 `pnpm lint:new-code:governance` 被用户已有 dirty-worktree 中 6 个无关文件阻塞；本次新增文件的 kebab-case、目录名和文档命名检查均已通过，且定向 ESLint/guard 无本次错误。

## 发布/部署方式

本次只完成本地源码、构建产物和隔离运行实例验证，没有提交、推送、发布 NPM 包或修改线上 Marketplace D1/R2 数据。

正式进入用户版本时，应随 NextClaw 的统一发布流程发布受影响的 Core 与 Kernel 包。远端 Marketplace 条目继续保留 `install_kind=marketplace`，作为旧版客户端的兼容安装入口；当前公共查询只展示这一类型，不能直接改成 `builtin`。如后续同步远端说明或兼容内容，应单独执行发布验证，但不能让远端副本覆盖新版 builtin owner。

## 用户/产品视角的验收步骤

1. 在未配置 `web_search` provider API key 的安装态中，请 Agent 用真实浏览器打开一个已知 URL。
2. 确认 Agent 不先调用注定失败的 `web_search`，并明确说明切换到浏览器自动化。
3. 首次未安装外部 CLI 时，确认 Agent 说明全局 npm 包和浏览器下载影响，并在安装前征得同意。
4. 已安装时，确认 Agent 读取 builtin skill、使用命名 session、实际读取页面并在完成后关闭 session。
5. 在 Marketplace 查看 `agent-browser`，确认产品将其识别为 builtin installed，而不是再次提供 workspace 安装/卸载路径。

## 可维护性总结汇总

已使用 `post-edit-maintainability-guard` 和 `post-edit-maintainability-review`。这是新增用户能力，生产路径的必要增长集中在一个既有 context owner 和一个声明式 builtin skill，没有新增 manager/service/factory，也没有复制浏览器实现。

测试从已接近函数预算的聚合测试文件迁到专用测试文件，并把 Kernel 新测试放入 `providers/tests/`，避免增加 provider 根目录预算压力。scoped guard 为 0 error；provider 目录 14/14 的历史 warning 有现存豁免且本次未恶化。保留的观察点是 Tooling prompt 的长期长度，但当前四条 web access 合同仍属于同一工具选择 owner，不值得拆出新 provider。

## NPM 包发布记录

- `@nextclaw/core`：包含新的 builtin skill 运行资产；本次未发布，待后续统一版本发布。
- `@nextclaw/kernel`：包含 web access readiness 与选路合同；本次未发布，待后续统一版本发布。
- 已添加 patch changeset；本次未执行 changeset version、registry publish 或 runtime update channel 发布。
