# 定位行文件预览完整性修复

## 迭代完成说明

修复带目标行打开小型文本或 Markdown 文件时，文件预览只展示目标附近内容并误报“内容已截断”的问题。

根因是 `server-path read` 把“目标行定位”无条件解释为“从目标行前 20 行开始读取”，即使文件本身远小于 200KB 预览上限，也会省略文件前部，并把非零读取偏移统一标记为 `truncated=true`。通过同一份 54,910 字节、1167 行的真实 Markdown 文件确认：修前携带 `line=1151` 时只返回第 1131 行之后的 2,278 字节，修后返回从第 1 行开始的完整 54,910 字节且 `truncated=false`。

修复落在服务端文件读取 owner：只有文件超过预览上限且目标行大于 1 时才选择目标附近窗口；小文件始终返回全文，由既有代码预览表面继续完成目标行滚动。没有在前端隐藏截断提示，也没有新增第二套文件读取链路。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-server exec vitest run src/features/server-path/controllers/server-path.controller.test.ts`：22 项通过，2 项跳过。
- `pnpm -C packages/nextclaw-ui exec vitest run src/features/chat/features/workspace/components/__tests__/chat-session-workspace-file-preview.test.tsx`：28 项通过。
- `pnpm -C packages/nextclaw-server tsc`：通过。
- `pnpm -C packages/nextclaw-server lint`：0 error；8 条 warning 均来自未触达的既有文件。
- 当前源码完整构建后，以临时 `NEXTCLAW_HOME` 在 `http://127.0.0.1:18989` 启动隔离实例；请求同一文件与 `line=1151`，响应为 `startLine=1`、`truncated=false`、`textBytes=54910`，并包含目标行。
- 当前开发实例 `http://127.0.0.1:18792` 使用同一请求复验，响应同样为 `startLine=1`、`truncated=false`、`textBytes=54910`。
- 隔离实例验收完成后已停止，构建生成物已通过 `pnpm clean:generated` 恢复。

## 发布/部署方式

本次不直接发布或部署。`@nextclaw/server` 需要随下一次统一 NPM patch 发布。

## 用户/产品视角的验收步骤

1. 在会话中点击一个带目标行的本地文本或 Markdown 文件链接，文件大小应小于 200KB。
2. 确认预览仍定位到目标行，但可以查看从第 1 行开始的完整文件，顶部不再显示“内容已截断”。
3. 再打开一个超过 200KB 且目标行位于后部的文本文件，确认仍展示目标附近内容并保留截断提示。

## 可维护性总结汇总

- 修复收敛在现有 `server-path read` owner，没有新增 helper、类型、API 字段、分支链路或文件读取入口。
- 删除了目标行等于 1 的独立特判，把窗口选择条件直接收敛为“目标行存在、目标行大于 1、文件超过预览上限”。
- 生产代码新增 8 行、删除 10 行、净减 2 行；测试新增 33 行、删除 5 行、净增 28 行；总代码新增 41 行、删除 15 行、净增 26 行。
- `post-edit-maintainability-review` 结论：通过；正向减债动作为简化分支和收敛行为条件，没有通过压缩命名或牺牲可读性凑行数。

## NPM 包发布记录

- `@nextclaw/server`：需要 patch 发布。
- 当前状态：本次已新增 changeset，尚未发布，待下一次统一发布。
