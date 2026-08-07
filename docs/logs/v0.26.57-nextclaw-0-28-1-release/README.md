# NextClaw 0.28.1 稳定版发布

## 迭代完成说明

- 本次迭代负责把已提交的用户可见 changeset 聚合为新的稳定 NPM patch 版本。
- 主要用户结果是全新安装可以直接使用 OpenCode Zen 免费试用模型，无需先填写 API Key；同时纳入聊天输入、侧栏导航、活动预览和并发消息显示改进。
- 发布从提交 `43b0e1d0727adb6c51bf56f9d3407cbf2091b3e5` 创建隔离 worktree，主工作区中的未提交改动不进入发布。

## 测试/验证/验收方式

- 发布前执行 release health、package group、README、changeset summary、构建、测试、TypeScript、lint、pack 与真实安装检查。
- 发布后验证 NPM registry 版本与 `latest` dist-tag，并从隔离目录安装 `nextclaw@0.28.1` 验证 CLI、默认配置和无密钥聊天路径。
- stable runtime channel 验证包含 check、download、apply、新进程版本与公开 manifest。

## 发布/部署方式

- 使用仓库统一 Changesets 发布流程，不从包目录直接执行 raw `npm publish`。
- NPM 发布后推送审计过的 source commit、package tags，并创建 GitHub Release。
- 通过仓库 stable runtime update owner 发布签名更新包；本批不涉及数据库 migration、后端部署或 Desktop 安装包发布。

## 用户/产品视角的验收步骤

1. 在隔离目录安装 `nextclaw@latest`。
2. 使用新的 `NEXTCLAW_HOME` 启动 NextClaw。
3. 确认默认模型为 `opencode/big-pickle`，OpenCode Zen 显示为就绪且无需 API Key。
4. 直接发送消息并收到回复。
5. 从旧稳定版执行 `nextclaw update --check`、download 和 apply，确认切换到 `0.28.1`。

## 可维护性总结汇总

- 本次发布阶段只新增用户发布说明、结构化 JSON、版本元数据和发布记录，不新增产品运行链路或平行发布入口。
- 功能源码的 owner、删减结果与维护性检查记录继续以 `docs/logs/v0.26.47-opencode-zen-free-models/README.md` 为准。
- 发布收尾将运行生成物洁净、governance、branch closure 与两个 worktree 状态检查。

## NPM 包发布记录

- 目标顶层版本：`nextclaw@0.28.1`，dist-tag 为 `latest`。
- Changesets 计算出 30 个公开包的 patch 依赖闭包；具体版本与 registry 状态在发布成功后补充。
- 当前状态：待版本化、发布与 registry 验证。
- stable runtime update channel、GitHub Release、公开 manifest 与产品更新笔记 URL 均属于本次发布闭环。
