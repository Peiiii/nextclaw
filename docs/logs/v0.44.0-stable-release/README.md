# NextClaw 0.44.0 常规稳定版发布

## 迭代完成说明

- 本批次包含 Markdown 文档目录、侧栏悬浮信息、会话标题展示、统一插话状态、队列错误刷新、匿名活跃汇总与 Desktop beta 更新检查。
- `nextclaw` 选择 minor：Markdown 文档目录与侧栏悬浮信息是向后兼容的新用户能力，其余增强与修复随同一产品闭包发布。
- 发布自动化同时收敛等待态、可恢复编排与确定性合同失败，避免把 registry、Pages 或 prepare artifact 的短暂不可见误判为产品失败。
- 正式发布从冻结的远程 `master` 单次 dispatch `release.yml target=product`，由 GitHub Actions 顺序完成 NPM 与 stable Runtime；Desktop 不在本次授权范围。

## 测试/验证/验收方式

- 发布自动化测试：`node --test scripts/release/*.test.mjs`，98/98 通过。
- stable release 合同测试：`node --test scripts/release/release-stable.test.mjs`，21/21 通过。
- 中英文文档与结构化 release notes：`pnpm --filter @nextclaw/docs build` 通过。
- release summary、JSON 解析、README 同步检查、release health 与新增代码治理检查通过。
- 正式 registry、Runtime、旧版本升级、GitHub Release 与主线闭合结果将在 workflow 完成后回填。

## 发布/部署方式

- 入口：GitHub Actions `.github/workflows/release.yml`，`target=product`。
- 认证：受保护 `npm-production` environment 中的 `NPM_TOKEN`。
- 目标版本：`nextclaw@0.44.0`；最终发布状态与运行链接将在 workflow 完成后回填。

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

## NPM 包发布记录

- 需要发布：是。本批包含用户可见新能力、默认行为变化与运行/UI 修复。
- 目标产品版本：`nextclaw@0.44.0`。
- 目标 dist-tag：`latest`。
- 实际包数、registry identity、耗时与真实安装结果将在 workflow 完成后回填。

发布过程观测见[工作记录](work/working-notes.md)。
