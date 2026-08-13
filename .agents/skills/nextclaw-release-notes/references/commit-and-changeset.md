# 提交与 Changeset

- 脏工作区做双向范围审计：staged 无无关改动，本轮生产代码、测试、运行时资源、changeset 和迭代记录也没有遗漏；触达文件的未暂存差异必须明确处理。
- 用户可见功能、bugfix、安装/运行/CLI/UI/agent 行为和公共 API 变化需要 changeset。
- 仅 AGENTS/skills、docs/logs/thoughts/plans、测试/lint/内部治理或无行为变化的重构不需要 changeset。
- 若同一需求已有正式本地化截图，在 changeset 中用 `release-note-image` 注释绑定 `images/screenshots/` 源文件；没有合格截图不写空声明。
- 有图片声明时运行 `pnpm release:summary -- --json` 校验路径和格式。
