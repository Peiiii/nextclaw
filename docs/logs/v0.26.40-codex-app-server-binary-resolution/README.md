# v0.26.40 Codex app-server binary 解析修复

## 迭代完成说明

- 根因是 Codex app-server client 从 `@openai/codex-sdk` 入口反推包目录后，假定 CLI 一定位于 SDK 私有的 `node_modules/.bin/codex`。该路径只在 pnpm 虚拟仓库布局中偶然存在，标准 NPM 安装会把 CLI shim 放在顶层 `node_modules/.bin`，因此发布态直接抛出 `Unable to locate Codex app-server binary from @openai/codex-sdk.`。
- 根因通过同版本 `@openai/codex-sdk@0.144.1` 的隔离 NPM 安装确认：SDK 内嵌 `.bin` 缺失、顶层 shim 与 `@openai/codex/bin/codex.js` 存在；这与用户错误发生在进程启动前的证据一致。
- 修复仍由 `CodexAppServerClient` 拥有启动命令解析。默认路径从 SDK 自己的依赖边界解析官方 `@openai/codex` CLI 入口，并用当前 Node 进程启动；显式 `codexPathOverride` 继续作为唯一替代路径。
- 删除 SDK 内嵌 `.bin` 探测、文件存在检查、平台 shim 名称判断和 PATH 拼接逻辑；没有增加全局 PATH、当前目录、全局安装或事故特征 fallback。

## 测试/验证/验收方式

- 修前基线：隔离 `npm install @openai/codex-sdk@0.144.1` 后确认 SDK 私有 `node_modules/.bin/codex` 缺失，旧解析候选必然失败。
- 定向回归测试：`codex-app-server-client.service.test.ts` 2 个用例通过，覆盖 SDK 依赖 CLI 入口与显式 override。
- package 全测：8 个测试文件、29 个用例通过。
- `pnpm --filter @nextclaw/nextclaw-ncp-runtime-codex-sdk tsc`：通过。
- package lint：0 error；保留 1 条与本次无关的既有 mapper warning。
- build：通过。
- 工作区真实 smoke：当前源码构建出的 client 成功完成 `app-server initialize` 握手。
- 发布布局真实 smoke：将当前 package 打包后安装到隔离 NPM 目录，确认 SDK 私有 `.bin` 缺失时仍成功完成同一 `app-server initialize` 握手。
- `pnpm lint:new-code:governance`、`pnpm check:governance-backlog-ratchet`、`pnpm check:generated-clean`：通过。

## 发布/部署方式

- 本次已提交到本地 `master`，并通过仓库 Changesets 流程发布 Codex NCP/NARP runtime patch。
- 未 push、未创建 PR；本批不包含顶层 `nextclaw`，因此不触发 NPM runtime update channel、产品 GitHub Release 或线上部署。
- 不涉及数据库 migration、生产配置、Desktop installer、update manifest 或主实例重启。

## 用户/产品视角的验收步骤

1. 使用标准 NPM 安装的 NextClaw 启动 Codex runtime。
2. 在已有 Codex 会话发送消息，确认不再出现 app-server binary 定位错误。
3. 新建 Codex 会话并发送消息，确认 runtime 可以初始化 app-server 并开始处理请求。
4. 配置显式 `codexPathOverride` 后重复验收，确认仍使用指定 CLI。

## 可维护性总结汇总

- `post-edit-maintainability-guard --non-feature`：通过，无阻塞项或警告；总代码 `+87/-35，净增 52`，排除测试后 `+16/-35，净减 19`。
- `post-edit-maintainability-review`：通过，`no maintainability findings`。
- 正向减债动作为删除与简化：移除依赖包管理器私有布局的探测分支和未使用的 PATH 辅助合同，把默认启动收敛到官方 CLI 入口这一条发布合同。
- owner、文件角色和目录结构未新增层级；没有隐藏 fallback、兼容双路径、参数搬运或环境扫描，生产代码更少且行为更可预测。

## NPM 包发布记录

- `@nextclaw/nextclaw-ncp-runtime-codex-sdk@0.2.16`：已发布到 NPM `latest`，修复标准 NPM 安装布局下的 app-server 启动。
- `@nextclaw/nextclaw-narp-runtime-codex-sdk@0.2.17`：已发布到 NPM `latest`，依赖精确更新为 Codex NCP runtime `0.2.16`。
- 仓库 `release:verify:published` 已确认两个版本可从 registry 读取；隔离安装后公共入口可正常导入。
- 本地 package tags 已生成；未执行 Git push、产品 GitHub Release 或 runtime update。
