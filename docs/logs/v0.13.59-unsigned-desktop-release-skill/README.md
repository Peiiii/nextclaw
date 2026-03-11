# v0.13.59 unsigned desktop release skill

## 迭代完成说明（改了什么）
- 新增可复用通用 skill：[`unsigned-desktop-release-playbook`](../../../.codex/skills/unsigned-desktop-release-playbook/SKILL.md)。
- 更新内部安装文档 [desktop-install-unsigned.md](../../internal/desktop-install-unsigned.md) 的 macOS 小白流程，补充“先点完成，再去隐私与安全性底部点仍要打开”。
- macOS 兜底命令统一为 `xattr -cr "/Applications/NextClaw Desktop.app"`，与当前发布说明口径一致。

## 测试/验证/验收方式
- 结构验证：
  - `test -f .codex/skills/unsigned-desktop-release-playbook/SKILL.md`
  - `test -f docs/internal/desktop-install-unsigned.md`
- 内容校验：
  - `rg -n "Done|仍要打开|xattr -cr" .codex/skills/unsigned-desktop-release-playbook/SKILL.md docs/internal/desktop-install-unsigned.md`
- 说明：本次仅文档与 skill 沉淀，不触达构建/类型/运行代码路径，`build/lint/tsc` 不适用。

## 发布/部署方式
- 不涉及代码产物部署。
- 对已发布 GitHub Release（`v0.9.21-desktop.7`）同步更新说明，补充 macOS 小白放行步骤：
  1. 首次双击触发拦截后点“完成”。
  2. 进入 `系统设置 -> 隐私与安全性`，在底部点击“仍要打开”。
  3. 若仍被判定损坏，再执行 `xattr -cr`。

## 用户/产品视角的验收步骤
1. 打开 `v0.9.21-desktop.7` Release 页面，确认教程包含“先点完成，再到隐私与安全性底部点仍要打开”。
2. mac 用户按教程操作，能够在无证书前提下完成启动。
3. Windows 用户按教程可完成 SmartScreen 放行并启动应用。
