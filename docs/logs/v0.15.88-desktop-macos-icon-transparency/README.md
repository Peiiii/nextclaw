# v0.15.88-desktop-macos-icon-transparency

## 迭代完成说明

本次迭代修复了 NextClaw macOS 桌面端图标“看起来不是圆角 app icon”的问题。

本次实际落地内容：

- 调整 [`apps/desktop/scripts/generate-icons.mjs`](/Users/peiwang/Projects/nextbot/apps/desktop/scripts/generate-icons.mjs)，删除基于 `qlmanage` 的 SVG 预览 PNG 中转。
- 图标生成链路改为直接用 `sips` 从 [`apps/landing/public/logo.svg`](/Users/peiwang/Projects/nextbot/apps/landing/public/logo.svg) 输出透明底 PNG，再生成：
  - [`apps/desktop/build/icons/icon.png`](/Users/peiwang/Projects/nextbot/apps/desktop/build/icons/icon.png)
  - [`apps/desktop/build/icons/icon.icns`](/Users/peiwang/Projects/nextbot/apps/desktop/build/icons/icon.icns)
  - [`apps/desktop/build/icons/icon.ico`](/Users/peiwang/Projects/nextbot/apps/desktop/build/icons/icon.ico)
- 根因不是品牌 Logo 本身，而是旧脚本先用 `qlmanage` 把 SVG 渲染成了白底 PNG，导致 `.icns` 最终携带白色方形底板，macOS 桌面上看起来不像干净的圆角图标。

## 测试/验证/验收方式

### 已完成验证

- `pnpm -C apps/desktop icons:generate`
  - 结果：通过
  - 说明：重新生成桌面端 `icon.png / icon.icns / icon.ico`
- `python3` 读取 [`apps/desktop/build/icons/icon.png`](/Users/peiwang/Projects/nextbot/apps/desktop/build/icons/icon.png) 像素
  - 结果：通过
  - 观察点：`(0,0) / (10,10) / (40,40) / (511,511)` alpha 均为 `0`，确认四角透明
- `CSC_IDENTITY_AUTO_DISCOVERY=false pnpm -C apps/desktop exec electron-builder --mac dir --publish never`
  - 结果：通过
  - 观察点：成功产出 `apps/desktop/release/mac-arm64/NextClaw Desktop.app`
- 从打包产物反解图标并做像素校验
  - 结果：通过
  - 观察点：[`apps/desktop/release/mac-arm64/NextClaw Desktop.app/Contents/Resources/icon.icns`](/Users/peiwang/Projects/nextbot/apps/desktop/release/mac-arm64/NextClaw%20Desktop.app/Contents/Resources/icon.icns) 解出的 `icon_512x512.png` 四角同样透明；打包产物内 `icon.icns` 与源码生成的 `icon.icns` MD5 一致
- `PATH=/opt/homebrew/bin:$PATH pnpm lint:new-code:governance -- apps/desktop/scripts/generate-icons.mjs`
  - 结果：通过

### 已执行但未全绿的验证

- `PATH=/opt/homebrew/bin:$PATH pnpm lint:maintainability:guard`
  - 结果：未通过
  - 判断：当前 error 全部来自 [`packages/nextclaw-core/src/providers/openai_provider.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw-core/src/providers/openai_provider.ts) 的另一批进行中改动，与本次桌面端图标链路无关；本次触达的 `apps/desktop/scripts/generate-icons.mjs` 已通过单文件增量治理检查

## 发布/部署方式

本次无需数据库变更、远程 migration 或额外部署动作。

如需正式带入下一个桌面端版本，建议顺序：

1. 合入本次图标脚本与图标资源变更。
2. 重新执行：
   - `pnpm -C apps/desktop icons:generate`
   - `CSC_IDENTITY_AUTO_DISCOVERY=false pnpm -C apps/desktop exec electron-builder --mac dir --publish never`
3. 在下一次桌面端正式发布时带出新的 macOS 安装产物。

## 用户/产品视角的验收步骤

1. 在 macOS 上安装最新桌面端构建产物。
2. 打开 `Applications` 或桌面，观察 NextClaw Desktop 图标。
3. 预期：图标外层不再带白色方形底板，而是只显示品牌主体，整体呈干净的圆角观感。
4. 打开 App 后再看 Dock 图标。
5. 预期：Dock 中的图标与桌面图标一致，不再出现白底方块感。

## 可维护性总结汇总

### 长期目标对齐 / 可维护性推进

本次改动是沿着“更少特殊路径、更少 surprise、更统一入口体验”前进的一小步。对用户来说，桌面端图标是入口识别的一部分；把错误的白底中转删除掉，比继续在打包链路上补额外遮罩或平台分支更符合长期简化方向。

### 可维护性复核结论

- 结论：通过
- 本次顺手减债：是
- no maintainability findings

### 代码增减报告

- 新增：2 行
- 删除：8 行
- 净增：-6 行

说明：以上为文本代码 diff 统计；另有 3 个二进制图标产物被重新生成，不计入行数。

### 非测试代码增减报告

- 新增：2 行
- 删除：8 行
- 净增：-6 行

说明：本次没有触达测试文件；非测试代码与总代码统计一致。作为非新增用户能力的修正，这次实现已经达到更优的净删除方向。

### 逐项判断

- 本次是否已尽最大努力优化可维护性：
  - 是；根因已经收敛到单一生成脚本，不需要再加平台补丁或第二套图标资源链
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”：
  - 是；删除了 `qlmanage` 白底中转与对应临时文件判断，直接从 SVG 生成透明图标
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：
  - 是；文本代码净删除 6 行，文件数与目录结构未恶化
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰：
  - 是；图标生成仍保持在单脚本内，且职责更纯粹，只负责从源 SVG 生成最终桌面端图标
- 目录结构与文件组织是否满足当前项目治理要求：
  - 是；仍沿用现有 `apps/desktop/build/icons` 与 `apps/desktop/scripts` 结构，没有新增额外层级

### 为什么这次没有继续扩展

- 本次问题是“桌面端图标生成流程错误”，不是“品牌图形需要重新设计”；继续扩展到重画品牌图标、引入新的设计文件格式或增加平台专属变体，都会超出最小必要修复范围。
- 当前修法已经让源 SVG、生成脚本和最终 `.icns` 三者重新一致，额外改造收益不高。
