# 迭代完成说明

- 修复聊天 tokenized composer 在 `Windows + Electron` 场景下，IME 预编辑态可能在 `compositionstart` 完整建立前就被组件自己的 DOM 同步清空的问题。
- 本次把保护收敛在 `ChatComposerRuntime`：
  - 新增 “IME 预组合窗口” 守卫；
  - 当键盘事件表现为 Windows IME 典型的 `Process / 229` 预组合阶段时，暂停 surface 重绘、selection 同步与 DOM 回读；
  - 等组合输入真正进入 `compositionstart` / `compositionend` 生命周期后，再恢复既有同步链路。
- 补充回归测试，覆盖 “Windows IME 在 `compositionstart` 之前，浏览器已把预编辑字符放进 DOM，但组件不能把它清空” 的事件顺序。
- 相关排查/方案记录见：[Windows Chat Composer IME Investigation Plan](../../plans/2026-04-10-windows-ime-chat-composer-investigation-plan.md)。

# 测试/验证/验收方式

- 已执行：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-agent-chat-ui test -- --run src/components/chat/ui/chat-input-bar/chat-input-bar.test.tsx`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-agent-chat-ui test -- --run src/components/chat/ui/chat-input-bar/chat-input-bar.test.tsx src/components/chat/ui/chat-input-bar/chat-input-bar-selection.test.tsx src/components/chat/ui/chat-input-bar/chat-composer-controller.test.ts src/components/chat/ui/chat-input-bar/chat-composer-dom.utils.test.ts src/components/chat/ui/chat-input-bar/chat-composer-keyboard.utils.test.ts src/components/chat/ui/chat-input-bar/chat-composer.utils.test.ts`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-agent-chat-ui tsc`
  - `PATH=/opt/homebrew/bin:$PATH pnpm exec eslint packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-input-bar/chat-input-bar.test.tsx packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-input-bar/chat-composer-runtime.ts`
  - `PATH=/opt/homebrew/bin:$PATH pnpm lint:maintainability:guard`
- 未执行：
  - Windows 真机 Electron 冒烟。
  - 原因：当前执行环境不是 Windows，无法在本地直接验证搜狗输入法与 Electron 桌面壳的真实交互。

# 发布/部署方式

- 本次未执行发布。
- 如需随版本发出，按既有前端/桌面发布流程打包即可；如果要把修复带到桌面用户，需确保包含本次 `@nextclaw/agent-chat-ui` 源码变更的桌面构建重新产物化。
- 发布前建议补一次 Windows 桌面真机冒烟，再推进桌面安装包更新。

# 用户/产品视角的验收步骤

1. 在 Windows 桌面端打开聊天页，切到搜狗输入法。
2. 在聊天输入框输入 `ni`、`nihao` 等拼音，确认候选窗不会在首个字母后立即消失。
3. 选择候选词，确认最终能正常上屏中文，不会只剩中间态字母。
4. 在输入框已有 skill token 或 file token 的情况下重复上述步骤，确认中文输入仍稳定。
5. 再验证英文输入、回车发送、`Shift+Enter` 换行、slash 菜单与删除行为没有回退。

# 可维护性总结汇总

- 基于本次独立的 post-edit maintainability review，结论：`通过`。
- 本次是否已尽最大努力优化可维护性：`是`。修复没有扩散到 container/store/page 层，而是收敛在已有的 `ChatComposerRuntime` 输入边界内。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：`是`。本次没有增加平台特化页面分支，也没有新建额外 helper/file，而是复用已有 composition 状态模型，只补一个最小必要的 pre-composition guard。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：
  - 代码净增长存在，但属于非新增用户能力修复的最小必要增长；
  - 没有新增运行时代码文件，聊天输入目录的直接文件数未继续增加；
  - 增长主要来自一个集中在 runtime 的保护边界和一条回归测试，用来覆盖此前未被测试捕获的 Windows IME 事件顺序。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：
  - 更清晰。IME 保护现在明确属于 `ChatComposerRuntime` 的 DOM ownership / input lifecycle 边界；
  - 没有把复杂度转移到 presenter、store 或 React effect，也没有新增额外抽象层。
- 目录结构与文件组织是否满足当前项目治理要求：
  - `packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-input-bar` 目录仍存在历史性平铺超预算问题；
  - 本次 `pnpm lint:maintainability:guard` 给出目录预算警告，但该问题并非本次引入，且本次未新增新的直接文件；
  - 下一步整理入口：按输入 surface / runtime / tests / toolbar 等职责进一步拆目录，降低该子树平铺度。
- 若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：
  - `是`。除守卫外，单独复核后的判断是：当前实现已经达到本问题的最佳实际收敛点；若再继续抽象，只会把本次 Windows IME 特性包装成更难理解的间接层。
