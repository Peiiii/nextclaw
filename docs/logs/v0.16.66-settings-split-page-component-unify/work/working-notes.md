# 当前目标

- 这轮唯一通过标准：相对 `HEAD`，非测试代码必须净减少。

# 当前事实

- 功能代码口径：`新增 982 / 删除 1037 / 净增 -55`。
- 已删除的过度拆分层：`provider-form-sections.tsx`、`use-provider-form-state.ts`、`use-provider-auth-flow.ts`、`search-provider-fields.tsx`、`channel-form-layout-blocks.tsx`、`use-provider-form-view-options.ts`、`provider-form-actions.ts`。

# 关键决策

- 保留唯一共享核心 `config-split-page.tsx`，其余页面回收到紧凑 owner 文件。

# 验证

- 设置页相关测试、`build`、`tsc --noEmit` 全部通过。
