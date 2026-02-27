# v0.8.29-skill-reinstall-json-fix

## 迭代完成说明
- 修复 UI 中 skill 在“安装 -> 卸载 -> 再安装”场景下报错：`failed to parse skild --json output`。
- 根因处理：
  - `skild --json` 在已有本地安装状态下可能返回 `null`，原实现仅接受对象，导致解析报错。
  - 卸载流程此前只删除 `workspace/skills/<slug>`，未清理 `workspace/.agents/skills/<slug>`，造成 skild 误判已安装。
- 具体改动：
  - `installGitMarketplaceSkill` 增加 `null` 自愈逻辑：首次返回 `null` 时自动追加 `--force` 重试。
  - `uninstallMarketplaceSkill` 同步清理 `workspace/skills/<slug>` 与 `workspace/.agents/skills/<slug>`。
  - `parseSkildJsonOutput` 支持 `null` 与数组格式（数组时提取首个对象）。

## 测试/验证/验收方式
- 强制验证：
  - `pnpm build`
  - `pnpm lint`
  - `pnpm tsc`
- 冒烟测试（隔离环境，非仓库目录写入）：
  - 设置 `NEXTCLAW_HOME=/tmp/...`，并将 `agents.defaults.workspace` 指向 `/tmp/...`。
  - 通过 `ServiceCommands` 执行：`installMarketplaceSkill(git) -> uninstallMarketplaceSkill -> installMarketplaceSkill(git)`。
  - 观察点：第二次安装成功，不再出现 JSON 解析错误。

## 发布/部署方式
- NPM 发布流程（按项目文档）：
  - `pnpm release:version`
  - `pnpm release:publish`
- 本次为 CLI/服务端行为修复，无额外基础设施部署步骤。

## 用户/产品视角验收步骤
- 打开 UI Marketplace 的 Skills 页面。
- 选择一个 `git` 类型 skill，点击安装，确认成功。
- 在已安装列表中卸载该 skill，确认成功。
- 再次点击安装同一 skill，确认安装成功且不再提示 `skild json output is not an object`。
