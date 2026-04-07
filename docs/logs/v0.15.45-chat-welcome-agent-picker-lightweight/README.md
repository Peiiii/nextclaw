# v0.15.45 Chat Welcome Agent Picker Lightweight

## 迭代完成说明

- 将新会话欢迎区里的 Agent 选择从重卡片式展示收敛为轻量控件。
- 去掉了大块选择容器、重复状态回显和厚重表单感，只保留一段极轻标签与“头像 + 下拉箭头”的选择入口。
- 保持下拉菜单本身仍可展示 Agent 名称，保证轻量化后仍有可理解性与可切换性。
- 同步把相关文案压缩为更符合当前产品风格的短句。

## 测试/验证/验收方式

- `PATH=/opt/homebrew/bin:/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm -C packages/nextclaw-ui test src/components/chat/ChatWelcome.test.tsx`
- `PATH=/opt/homebrew/bin:/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm -C packages/nextclaw-ui tsc`
- `PATH=/opt/homebrew/bin:/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm lint:maintainability:guard`

## 发布/部署方式

- 不适用。本次未执行发布，仅完成本地界面调整与验证。

## 用户/产品视角的验收步骤

1. 打开新的聊天 / 绘画欢迎页。
2. 观察 Agent 选择区域，应只看到一段很轻的标签和一个极简选择控件。
3. 选择控件默认展示当前 Agent 头像与下拉箭头，不再出现大块输入框式边框和重复说明。
4. 点击控件展开列表，仍可看见各 Agent 的头像与名称，并能正常切换。
5. 切换 Agent 后继续创建新会话，确认行为不受影响。

## 可维护性总结汇总

- 本次是否已尽最大努力优化可维护性：是。重点不是叠加新样式，而是直接删除原先过重的信息层和重复表达。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。核心收敛是把“大卡片 + 按钮组 + 当前态提示”压成“轻标签 + 单控件”。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：基本做到。未新增源代码文件，目录平铺度未恶化；当前代码 diff 统计为新增 47 行、删除 39 行、净增 8 行，其中非测试代码新增 40 行、删除 37 行、净增 3 行，属于小幅净增但已接近最小必要。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：更清晰。仅在现有 `ChatWelcome` 内完成结构收敛，没有新增中间层或样式包装组件。
- 目录结构与文件组织是否满足当前项目治理要求：本次没有新增目录问题，但 `packages/nextclaw-ui/src/components/chat` 与 `packages/nextclaw-ui/src/lib` 仍存在历史目录预算 warning；本次未继续恶化。
- 若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：是。本次结论基于对“能否继续删减可见层信息、是否仍有多余 UI 语义”的独立复核得出。
