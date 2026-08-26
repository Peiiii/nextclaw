# NextClaw 0.44.0 常规稳定版发布

## 迭代完成说明

- 本批次包含 Markdown 文档目录、侧栏悬浮信息、会话标题展示、统一插话状态、队列错误刷新、匿名活跃汇总与 Desktop beta 更新检查。
- `nextclaw` 选择 minor：Markdown 文档目录与侧栏悬浮信息是向后兼容的新用户能力，其余增强与修复随同一产品闭包发布。
- 发布自动化同时收敛等待态、可恢复编排与确定性合同失败，避免把 registry、Pages 或 prepare artifact 的短暂不可见误判为产品失败。
- 正式发布从冻结的远程 `master` 单次 dispatch `release.yml target=product`，由 GitHub Actions 顺序完成 NPM 与 stable Runtime；Desktop 不在本次授权范围。

## 测试/验证/验收方式

- 发布自动化测试：`node --test scripts/release/*.test.mjs`，99/99 通过。
- stable release 合同测试：`node --test scripts/release/release-stable.test.mjs`，21/21 通过。
- 中英文文档与结构化 release notes：`pnpm --filter @nextclaw/docs build` 通过。
- release summary、JSON 解析、README 同步检查、release health 与新增代码治理检查通过。
- 正式 run `32877479224` 最终成功：23/23 NPM package identity、stable Runtime 四平台资产、公开 manifests、GitHub Release 和从 `0.43.0` 升级到 `0.44.0` 均通过。
- 首次 NPM job 在 23 个上传命令成功后，因 `harness` 与 `server` 超过 120 秒仍不可见而保护性停止；failed-job recovery 没有重复上传，明确报告 `0 upload(s), 23 already visible` 后完成 Git 与 Runtime 闭环。这证明失败来自 registry 传播窗口不足，不是包内容错误。
- GitHub Release 首次公开时正文 owner 只消费了结构化 notes URL，仍输出通用 fallback 和英文 changeset/依赖列表；同一 Release 已原地修复为完整双语正文。根因 owner 已改为直接渲染结构化 JSON 的中英文 summary、sections 和各自语言链接，后续 release 不再重复生成半成品正文。

## 发布/部署方式

- 入口：GitHub Actions `.github/workflows/release.yml`，`target=product`。
- 认证：受保护 `npm-production` environment 中的 `NPM_TOKEN`。
- 目标版本：`nextclaw@0.44.0`，`latest` 已公开。
- 正式运行：[GitHub Actions 32877479224](https://github.com/Peiiii/nextclaw/actions/runs/32877479224)，最终状态 `success`、`CONTENT_READY`。
- GitHub Release：[NextClaw v0.44.0](https://github.com/Peiiii/nextclaw/releases/tag/nextclaw%400.44.0)，包含 darwin arm64/x64、linux x64、win32 x64 四份 Runtime ZIP。
- Release 正文已回读确认中文在前、English 在后，各自包含功能、增强、修复与兼容性内容，并使用对应语言的绝对更新说明链接；没有自动 commit、changeset 或依赖列表噪音。
- prepare 耗时 5 分 57 秒；首次正式尝试 3 分 59 秒后保护性停止；恢复尝试 16 分 02 秒，其中 NPM prepared publish/Git 闭合 17 秒，Runtime job 9 分 13 秒，最慢有效工作 step 为 Runtime 发布与验证 6 分 42 秒。含失败恢复的正式 run 总 wall time 22 分 59 秒；从 release-bearing push 到产品闭合共 29 分 19 秒。

## 用户/产品视角的验收步骤

1. 在 Markdown 预览路径栏打开目录并跳转到任意标题。
2. 悬停侧栏会话和项目，确认关联项目、子会话与定时任务信息完整且操作图标不重叠标题。
3. 分别直接插话和排队后插话，确认消息状态、顺序与更多操作入口一致。
4. 在旧队列项已经开始运行后再次插话，确认过期错误自动清除。
5. 在隐私设置中确认匿名活跃汇总的本机投递状态，不包含稳定安装标识或内容数据。

## 可维护性总结汇总

- 产品变更继续复用现有 Kernel/UI owner，没有为发布复制产品语义。
- 正式发布统一由 release workflow、exact commit artifact 和单一版本 identity 驱动。
- 暂时不可见只进行有界等待；标签、版本、公钥、资产和 immutable manifest 冲突继续快速失败。
- 生产证据表明 NPM package identity 可能超过 120 秒才公开；默认 registry 等待窗调整为 15 分钟，等待期间禁止重复上传，超时恢复继续按 prepared integrity 复用已成立 identity。
- Release 正文只由 exact-version 结构化 notes 生成；完整结构化内容存在时不再混用 changelog fallback，内容缺失时才使用确定性核心发布说明。

## NPM 包发布记录

- 需要发布：是。本批包含用户可见新能力、默认行为变化与运行/UI 修复。
- 目标产品版本：`nextclaw@0.44.0`。
- 目标 dist-tag：`latest`。
- 实际发布：23 个 package，registry version/integrity/latest 回读全部通过。
- 真实安装与升级：workflow 从公开 `0.43.0` 完成 check、download、apply 和新进程 `0.44.0` 验证。
- NPM_READY：恢复尝试的 prepared publish/Git 闭合为 17 秒，达到 60 秒性能目标；首次尝试因 registry 外部传播未形成 NPM_READY。

发布过程观测见[工作记录](work/working-notes.md)。
