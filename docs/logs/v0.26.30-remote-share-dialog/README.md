# v0.26.30 Remote 分享入口可见性修复

## 迭代完成说明

- 根因：实例列表的“分享”按钮已经正确更新 `selectedInstanceId` 并请求分享链接，但 `RemoteShareGrantPanel` 被追加在完整实例表格和分页之后；主滚动区不移动，也没有对话框或焦点反馈，因此面板虽已进入 DOM，用户当前视口仍看不到任何变化。
- 根因确认：修前在同一浏览器链路中点击首行“分享”，请求成功发出一次，但桌面端分享表面 `top=1572.5px`、视口高度 `900px`，明确位于视口外；移动端也复现相同行为。新增回归后，旧实现稳定报错 `Share surface is outside the current viewport`。
- 修复方式：保留现有 action manager、query 和 mutation owner，只把分享管理表面改为浏览器原生模态 `dialog`。点击后立即进入顶层视口；关闭按钮使用 `method="dialog"`，并支持 Esc 关闭和浏览器原生焦点恢复。
- 这是根因修复而不是症状补丁：没有修改分享 API、没有引入 `navigator.share` 或滚动位置特判，而是修正“分享管理表面必须立即可见”的展示合同。
- 回归覆盖桌面与移动端真实视口，断言对话框可见、关闭后焦点归还、Esc 可关闭。

## 测试/验证/验收方式

- 修前失败基线：`PLATFORM_CONSOLE_BASE_URL=http://127.0.0.1:5176 pnpm smoke:platform:console`，失败信息为分享表面位于视口外。
- 源码开发实例：同一命令修后通过。
- 正式构建预览：`pnpm -C apps/platform-console build` 后，以 `http://127.0.0.1:4173` 启动 preview；`PLATFORM_CONSOLE_BASE_URL=http://127.0.0.1:4173 pnpm smoke:platform:console` 通过。
- `pnpm -C apps/platform-console tsc`：通过。
- `pnpm -C apps/platform-console lint`：通过。
- `pnpm lint:new-code:governance`：在只应用本次补丁的隔离工作树中通过；主工作区的全量命令被并行改动中的 `workspace-reference-materializer.service.ts` 既有问题阻断，与本次文件无关。
- `pnpm check:governance-backlog-ratchet`：通过。

## 发布/部署方式

- 本轮未部署线上环境，也未执行 Git 提交或推送；用户本轮只要求修复并验证。
- 后端、数据库与 migration 不适用：本次只调整 Platform Console 展示组件与浏览器冒烟。

## 用户/产品视角的验收步骤

1. 打开 Platform Console 的“我的实例”列表。
2. 在任意当前实例行点击“分享”。
3. 分享链接对话框应立即出现在当前视口，而不是静默出现在长列表末尾。
4. 点击“收起”后，对话框关闭，键盘焦点回到刚才的“分享”按钮。
5. 再次打开对话框并按 Esc，对话框应关闭。
6. 在移动端宽度重复上述步骤，对话框仍应完整进入视口并可滚动访问内容。

## 可维护性总结汇总

- 本次是纯 bugfix，生产代码新增 11 行、删除 12 行、净减 1 行；新增体量主要是原生 dialog 合同，删除来自同一操作组件内的单次派生简化与无消费者测试标识清理。
- 没有新增组件、helper 文件、兼容分支、API 路径或状态源；query/mutation owner 与分享 URL 生成链路保持不变。
- `RemoteShareGrantPanel` 继续是分享展示 owner，实例 action manager 继续负责复制和选择命令；组件类型与父级位置稳定，只有用户主动打开/关闭时发生挂载和卸载。
- maintainability guard：包含自动化测试的代码总计新增 84 行、删除 14 行、净增 70 行；生产组件新增 11 行、删除 12 行、净减 1 行。现有 `scripts/smoke` 目录数量例外和 492/500 行主冒烟文件警告均未被本次扩大。
- 主观可维护性复核通过：分享状态、请求与展示 owner 没有新增平行链路；新回归被拆入明确的 `.test.mjs` 文件，没有继续膨胀主冒烟文件。

## NPM 包发布记录

不涉及 NPM 包发布。Platform Console 是私有 Web 应用，本轮没有 package version 变更。
