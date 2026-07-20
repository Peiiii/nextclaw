# v0.26.6 项目列表密度优化

## 迭代完成说明

- 收紧聊天侧边栏 Project 视图的项目行高与项目组间距，让多个项目连续排列时更紧凑。
- 根因是项目组容器使用了 `12px` 纵向间距，同时每个项目行固定为 `40px`；两者叠加后，相邻项目中心距达到 `52px`。修复将项目行收紧到 `32px`、组间距收紧到 `2px`，中心距降为 `34px`。
- 修复直接落在 `ChatSidebarProjectGroups` 这一列表展示 owner，没有修改会话数据、折叠状态、创建会话或置顶链路，也没有新增全局样式、组件变体或页面覆盖。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/ui test -- src/features/chat/features/session/components/__tests__/chat-sidebar-project-groups.test.tsx`：通过，1 个测试文件 / 3 个测试；密度合同固定为 `space-y-0.5` 与 `h-8`。
- `pnpm --filter @nextclaw/ui tsc`：通过。
- `pnpm --filter @nextclaw/ui lint`：通过。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths <本次组件与测试>`：通过，0 error / 0 warning；总代码 `+5/-4`、净增 1 行，非测试代码 `+2/-2`、净增 0 行。
- `pnpm lint:new-code:governance -- --files <本次组件与测试>`：通过。全工作区 `pnpm lint:new-code:governance` 被并行未提交改动 `workers/nextclaw-provider-gateway-api/src/services/remote-access.service.ts` 的既有文件角色问题阻塞，本次未触达该文件。
- `pnpm check:governance-backlog-ratchet`：通过。
- 真实页面 `http://127.0.0.1:5174/chat`：切换到 Project 视图并折叠 `my-resume`、`nextbot`、`kb` 后，三个项目行高度均为 `32px`，相邻空白均为 `2px`，中心距均为 `34px`；新增与置顶按钮完整可见。

## 发布/部署方式

- 本次未执行 commit、push、前端发布、NPM publish、Desktop 打包或宿主重启。
- 当前源码 Vite 实例已通过热更新消费修复；已安装产品实例需等待后续 UI/NPM 版本发布。
- 数据库 migration、后端部署和运行时更新不适用，本次只修改前端列表密度。

## 用户/产品视角的验收步骤

1. 打开聊天页左侧会话列表，切换到 Project 视图。
2. 折叠多个项目，确认项目行连续紧凑排列，不再出现大块纵向留白。
3. 将鼠标移到项目行，确认整行 hover、折叠/展开、新建任务和置顶操作仍可正常使用。

## 可维护性总结汇总

- `post-edit-maintainability-guard` 与 `post-edit-maintainability-review` 结论为通过：总代码 `+5/-4`、净增 1 行；排除测试后生产代码 `+2/-2`、净增 0 行。
- 正向减债动作是简化现有密度合同：直接替换项目组 owner 的两个尺寸 token，没有新增状态、分支、函数、组件、文件或目录，也没有把样式移到全局覆盖层。
- 这不是机械压缩行数：生产代码行数持平，列表密度、点击区域与右侧操作尺寸之间的关系更明确；没有文件级、目录级、函数级、命名职责或红区风险。

## NPM 包发布记录

- `@nextclaw/ui`：已添加 patch changeset `.changeset/compact-project-list-density.md`，本次未发布，待后续统一发布。
- 其它 NPM 包：不涉及。
