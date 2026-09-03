# Project 安全移除能力

## 迭代完成说明

Project 注册表此前只支持创建、登记和读取，没有移除状态；如果仅从活动数组删除，kernel 又会在启动时依据历史会话目录重新导入项目，因此无法提供稳定的删除结果。

本次将注册表升级为活动项目与已移除项目双集合，由 kernel `ProjectManager` 统一拥有移除和恢复语义。UI 使用“从项目列表移除”并在二次确认中明确影响；HTTP 与 CLI 还要求精确 Project ID 确认。移除不触碰本地目录、历史会话或 Project Work，显式重新添加同一路径时恢复原 Project ID。根据交互反馈，入口最终位于按项目查看的会话列表项目行最右侧“更多操作”菜单，菜单项和确认动作均采用普通样式，详情页不再常驻展示该动作。

## 测试/验证/验收方式

- kernel、server、client SDK、UI、service 与 CLI 共 53 项定向测试通过。
- 六个受影响 TypeScript package 的 `tsc --noEmit` 通过；UI 使用 ES2023 lib 复核，标准配置仍有与本次无关的既有 `Array.findLast` lib 欠账。
- 完整依赖构建通过，命令全集同步测试通过，定向 ESLint 无错误。
- 真实源码 CLI 跨独立进程验证：错误确认被拒绝、正确确认后活动项目数为 0、本地目录保留、显式重加恢复同一 ID。
- diff-only maintainability guard 为 0 error；既有目录和文件预算信号经主观复核后无 finding。

## 发布/部署方式

本次仅提交并合入 `origin/master`，不发布 NPM、runtime 或 Desktop。用户可见变化已写入 changeset，随下一次稳定版本统一发布。

## 用户/产品视角的验收步骤

1. 打开任一 Project，点击“从项目列表移除”。
2. 确认弹窗明确说明本地目录、历史会话和 Project Work 都不会删除，取消后项目保持不变。
3. 确认移除后返回项目列表；该项目不再出现在 Project 入口，历史会话仍可使用。
4. 重新添加同一本地目录，项目以原 ID 恢复。
5. CLI 使用 `nextclaw projects remove <project-id> --confirm <project-id>` 得到相同行为。

## 可维护性总结汇总

产品语义和状态迁移集中在 kernel owner；server、SDK、UI 与 CLI 仅复用同一合同，没有新增平行 store、兼容双写或级联删除分支。注册表 v3 通过既有原子写入路径保存 tombstone，启动导入显式跳过已移除根目录。自动检查报告 0 error；SDK 测试文件、server app 目录及 router 的既有预算信号未因新增文件或路由体积而恶化，主观复核无未关闭 finding。

## NPM 包发布记录

本次不执行 NPM 包发布。changeset 标记 `@nextclaw/kernel`、`@nextclaw/server`、`@nextclaw/client-sdk`、`@nextclaw/ui`、`@nextclaw/service` 与 `nextclaw`，状态为待统一发布。
