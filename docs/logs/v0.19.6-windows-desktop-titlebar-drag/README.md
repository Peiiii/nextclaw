# v0.19.6-windows-desktop-titlebar-drag

## 迭代完成说明

- 修复 Windows 桌面端移除原生标题栏后窗口拖拽失效的问题。
- 根因：自定义标题栏拖拽区域只声明了旧的 `-webkit-app-region`，而 Electron 当前自定义窗口交互合同使用 `app-region` 标记拖拽与非拖拽区域；Windows 标题栏 overlay 场景下该合同缺口会导致可拖拽区域不稳定或失效。
- 修复方式：在 [index.css](../../../packages/nextclaw-ui/src/index.css) 的 `.desktop-window-drag` / `.desktop-window-no-drag` 中补齐 `app-region`，同时保留 `-webkit-app-region` 兼容旧实现，并给拖拽区加 `user-select: none` 避免拖动时选中文本。
- 本次没有改 Electron 主进程窗口参数，也没有新增第二套拖拽逻辑；owner 仍然是 UI 全局的桌面窗口 chrome 样式。

## 测试/验证/验收方式

- 已通过：`pnpm -C packages/nextclaw-ui test -- src/platforms/desktop/components/desktop-app-shell.test.tsx`
- 已通过：`pnpm -C packages/nextclaw-ui build`
- 已通过：构建产物 grep，确认 CSS 中包含 `-webkit-app-region:drag`、`app-region:drag`、`-webkit-app-region:no-drag`、`app-region:no-drag`。
- 已通过：`pnpm lint:new-code:governance -- packages/nextclaw-ui/src/index.css`
- 已通过：`pnpm check:governance-backlog-ratchet`
- 已知阻塞：`pnpm -C packages/nextclaw-ui lint` 被既有 UI lint 债务阻塞；`pnpm lint:new-code:governance` 全仓模式被当前工作区已有 attachment 改动阻塞，均不由本次 CSS 改动引入。
- `tsc` 不适用：本次只改 CSS，没有触达 TypeScript 源码、类型声明或导入导出边界。
- Windows 真机拖拽未在本机执行：当前环境不是 Windows 桌面 GUI。

## 发布/部署方式

- 未发布、未部署。
- 后续发布桌面 beta / stable 时，需要让 `packages/nextclaw-ui` 构建产物进入 `nextclaw` runtime bundle，并走桌面发布验证链路。

## 用户/产品视角的验收步骤

1. 在 Windows 上启动 NextClaw Desktop。
2. 在顶部自定义标题栏空白区域按住鼠标左键拖动。
3. 观察窗口应跟随鼠标移动，右上角原生最小化、最大化、关闭按钮仍正常可用。
4. 点击标题栏里的按钮或状态入口时，不应被拖拽区域吞掉点击事件。

## 可维护性总结汇总

- 本次遵守单一路径：继续使用 Electron 标准 app-region 合同，没有增加 JS 拖拽兜底或平台特判。
- 非测试代码增减：新增 3 行、删除 3 行、净增 0 行。
- 正向减债动作：简化。移除相邻的装饰性分隔注释，用同等行数补齐真实运行合同，避免为兼容属性额外膨胀文件。
- `post-edit-maintainability-guard` 对 CSS 文件提示不适用，因为该脚本只识别 code-like 文件；已用 diff 统计和人工可维护性复核替代。

## NPM 包发布记录

- 不涉及 NPM 包发布。
