# v0.18.40 Docs Project Pulse Build

## 迭代完成说明

- 根因：Project Pulse 图表直接依赖 ECharts，VitePress 构建需要把重型客户端图表库纳入 client/server bundle，导致 docs 构建内存峰值过高，在内存较紧环境中可能被系统以 `Killed: 9 / 137` 终止。
- 确认方式：本地复现 `pnpm --filter @nextclaw/docs build`，构建可通过但峰值 RSS 曾达到约 726MB，且 Rollup 提示存在超过 500KB 的大 chunk。
- 修复方式：将 Project Pulse 趋势图收敛为组件内轻量 SVG 渲染，移除 `echarts` 依赖和 lockfile 中的 `echarts` / `zrender` / 旧 `tslib` 条目，并补回原生 SVG hover tooltip。
- 为什么命中根因：构建不再打包 ECharts，大 chunk 警告消失，docs build 内存峰值下降；hover tooltip 通过预览页真实鼠标移动验证。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/docs build`：通过，`vitepress build` 完成。
- `/usr/bin/time -l pnpm --filter @nextclaw/docs build`：通过，最后一次峰值 RSS 约 514MB。
- `pnpm --filter @nextclaw/docs preview --host 127.0.0.1 --port 4173 --strictPort`：本地预览启动成功。
- Playwright 冒烟访问 `http://127.0.0.1:4173/zh/project/project-pulse`：检测到 4 个 SVG 图表、4 条趋势线；鼠标移动到首个图表后检测到 1 个 tooltip 和 1 个 hover guide，tooltip 文本包含日期、数值和单位。
- `rg -n "echarts" apps/docs pnpm-lock.yaml --hidden`：无命中。
- `pnpm exec eslint apps/docs/.vitepress/components/project-pulse/ProjectPulseTrendChart.vue`：仓库 ESLint 未配置 `.vue` 匹配，输出 ignored warning，无实际 lint 覆盖。
- `pnpm lint:new-code:governance`：被当前工作区无关改动阻塞，阻塞项来自 `apps/tt2048/game.js` 与 `packages/ncp-packages/nextclaw-ncp-toolkit/src/agent/agent-backend/*` 命名/角色治理问题，非本次 docs 改动。
- `pnpm check:governance-backlog-ratchet`：通过。

## 发布/部署方式

- 已执行 `pnpm deploy:docs`。
- Cloudflare Pages 部署成功，部署预览地址：`https://9cb1392f.nextclaw-docs.pages.dev`。
- wrangler 上传结果：上传 112 个文件，222 个文件已存在。

## 用户/产品视角的验收步骤

1. 运行 `pnpm deploy:docs`，确认不再在 `vitepress build` 阶段出现 `Killed: 9 / 137`。
2. 打开 `/zh/project/project-pulse` 或 `/en/project/project-pulse`。
3. 鼠标移动到趋势图曲线区域，确认能看到日期、具体数值和单位的 tooltip。

## 可维护性总结汇总

- 本次使用 `post-edit-maintainability-review` 做人工复核。
- 正向减债动作：删除。
- 删除 ECharts 运行时依赖，避免 docs 构建和前端页面为四张简单趋势图承担重型图表库成本。
- 非测试代码增减报告：新增 260 行，删除 263 行，净增 -3 行；满足非功能改动 `非测试代码净增 <= 0`。
- `post-edit-maintainability-guard` 对当前触达的 `.vue` / package / lockfile 输出 `not applicable`，因为脚本未识别这些路径为 code-like files。
- 仍保留的风险：仓库 ESLint 当前没有覆盖 VitePress `.vue` 文件，后续可考虑为 docs app 增加 Vue lint/typecheck 入口。

## NPM 包发布记录

不涉及 NPM 包发布。
