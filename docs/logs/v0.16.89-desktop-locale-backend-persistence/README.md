# v0.16.89-desktop-locale-backend-persistence

## 迭代完成说明

- 修复桌面端 UI 语言在完整重启后回退为英文的问题：桌面端改为通过 Electron preload / IPC 把语言偏好读写到 launcher state，浏览器端与 PWA 仍继续使用 `localStorage`。
- 根因已确认，不是表象修补。原来的语言持久化逻辑只写浏览器 `localStorage`，键为 `nextclaw.ui.language`。这条路径在浏览器里成立，但桌面端 UI 实际运行在本地 runtime 提供的 `http://127.0.0.1:<port>` 页面上，完整重启应用后 runtime 端口可能变化，导致 origin 变化，旧 origin 下的 `localStorage` 对新启动的桌面页面不可见。
- 根因确认方式：对比了 [`packages/nextclaw-ui/src/shared/lib/i18n/runtime/i18n-language-owner.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw-ui/src/shared/lib/i18n/runtime/i18n-language-owner.ts) 的持久化路径与 [`apps/desktop/src/main.ts`](/Users/peiwang/Projects/nextbot/apps/desktop/src/main.ts) 的桌面 runtime 加载方式，确认语言偏好此前被绑在“页面 origin”上，而不是“桌面应用实例”上；这正好解释了“系统语言英文、桌面端切中文、重启后又回英文”的用户反馈。
- 本次修复命中根因的原因：桌面端不再依赖会随 runtime origin 漂移的 `localStorage`，而是改为依赖 launcher 级别的持久状态 [`apps/desktop/src/launcher/stores/launcher-state.store.ts`](/Users/peiwang/Projects/nextbot/apps/desktop/src/launcher/stores/launcher-state.store.ts)；浏览器端仍保留原来的 `localStorage` 路径，因此没有把两个运行环境硬揉成同一套存储策略。

## 测试/验证/验收方式

- `pnpm -C apps/desktop exec tsc --noEmit`
- `pnpm -C packages/nextclaw-ui exec tsc --noEmit`
- `pnpm -C packages/nextclaw-ui exec vitest run src/shared/lib/i18n/runtime/i18n-language-owner.test.ts`
- 桌面 backend 冒烟：将 [`apps/desktop/src/launcher/stores/launcher-state.store.ts`](/Users/peiwang/Projects/nextbot/apps/desktop/src/launcher/stores/launcher-state.store.ts) 单独编译到临时目录后执行真实读写，确认 `languagePreference` 写入 `launcher-state.json` 后可稳定回读为 `zh`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths apps/desktop/src/launcher/stores/launcher-state.store.ts apps/desktop/src/main.ts apps/desktop/src/preload.ts apps/desktop/src/utils/desktop-ipc.utils.ts apps/desktop/src/services/desktop-presence.service.ts packages/nextclaw-ui/src/platforms/desktop/types/desktop-update.types.ts packages/nextclaw-ui/src/shared/lib/i18n/runtime/i18n-language-owner.ts packages/nextclaw-ui/src/shared/lib/i18n/runtime/i18n-language-owner.test.ts`
- 验证结果：
  - 桌面端 TypeScript 检查通过。
  - UI 包 TypeScript 检查通过。
  - `i18n-language-owner` 定向测试通过，`3/3` 用例通过，覆盖了“桌面端优先读 bridge / 桌面端写 backend / 浏览器端继续用 localStorage”三条主路径。
  - 桌面 backend 冒烟通过，确认语言偏好可在临时 launcher state 文件中稳定落盘并回读。
  - 可维护性守卫未通过：这是一次非新功能修复，但非测试代码仍净增 `+59` 行，未满足仓库对非功能改动的严格门槛。

## 发布/部署方式

- 本次不涉及额外脚本或迁移步骤。
- 桌面端在下次正常打包发布时会自动携带该修复。
- 本地验证时，重新启动桌面应用即可加载新的语言偏好持久化路径。

## 用户/产品视角的验收步骤

1. 将系统语言保持为英文。
2. 启动桌面版 NextClaw，并把应用内语言切换为中文。
3. 完整退出桌面应用，而不是仅关闭窗口到后台。
4. 重新启动桌面应用。
5. 确认应用仍保持中文，而不是回退到英文。
6. 额外在浏览器或 PWA 中切换语言并刷新页面，确认网页端仍通过浏览器本地存储保持各自语言偏好。

## 可维护性总结汇总

- 本次是否已尽最大努力优化可维护性：否。已经做了两轮收缩，把独立的 locale service 删除并并回现有的 [`DesktopPresenceService`](/Users/peiwang/Projects/nextbot/apps/desktop/src/services/desktop-presence.service.ts)，同时把 launcher state 中的语言字段拍平，避免为了一个桌面偏好再长出额外 manager / store / 嵌套对象；但按仓库当前规则，非功能改动的非测试净增仍必须 `<= 0`，这条门槛本次尚未满足。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。相比第一版实现，本次已经删除独立 `DesktopLocalePreferenceService`，把语言持久化 owner 收回现有桌面 presence IPC 主干，没有引入环境 manager、系统信息 store 或额外抽象层。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：部分做到。实现中删除了一个新增 service 文件，避免了文件数继续增长，但最终非测试代码仍净增 `+59` 行。当前净增长的最小必要性主要来自三处合同补齐：桌面 bridge 暴露语言偏好、桌面后端读写 launcher state、i18n owner 区分桌面与浏览器两条存储路径。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰：是。桌面语言偏好现在挂在已有 launcher state 上，由已有桌面 service owner 负责 IPC；前端 i18n owner 只负责“按环境选择存储边界”，没有再向上扩成额外环境管理系统。
- 目录结构与文件组织是否满足当前项目治理要求：基本满足。改动均落在现有 desktop launcher / service / preload / i18n owner 责任边界内，没有新增散落目录；但 [`apps/desktop/src/main.ts`](/Users/peiwang/Projects/nextbot/apps/desktop/src/main.ts) 仍接近文件预算上限，需要持续关注。
- 独立于实现阶段的可维护性复核结论：需继续修改。
- 长期目标对齐 / 可维护性推进：这次朝“按真实运行边界设计系统，而不是靠环境兜底拼补丁”的方向推进了一小步，也符合“桌面端走应用级持久化、浏览器端走浏览器级持久化”的清晰边界；但在“非功能改动不增码”这条更激进的长期方向上，还没有达标。
- 代码增减报告：
  - 新增：158 行
  - 删除：4 行
  - 净增：+154 行
- 非测试代码增减报告：
  - 新增：63 行
  - 删除：4 行
  - 净增：+59 行

## NPM 包发布记录

- 不涉及 NPM 包发布。
