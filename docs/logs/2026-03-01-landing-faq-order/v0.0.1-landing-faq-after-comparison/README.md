# 2026-03-01 Landing FAQ Order

## 背景 / 问题

- 用户要求将 Landing 页面中的“常见问题”模块放到“生态对比”模块后面，保持页面信息流一致。

## 决策

- 仅调整 `apps/landing/src/main.ts` 中 section 的渲染顺序。
- 不修改文案、样式和交互逻辑，确保风险最小。

## 变更内容（迭代完成说明）

- 用户可见变化：
  - Landing 页面模块顺序从“常见问题 -> 生态对比”调整为“生态对比 -> 常见问题”。
- 关键实现点：
  - `apps/landing/src/main.ts`：将 `#faq` section 移动到 comparison section 后。

## 测试 / 验证 / 验收方式

```bash
pnpm --filter @nextclaw/landing build
pnpm --filter @nextclaw/landing tsc
rg -n '<section id="faq"|this.copy.comparisonTitle' apps/landing/src/main.ts
```

验收点：

- `build` 与 `tsc` 成功通过。
- 在 `apps/landing/src/main.ts` 中，comparison section 出现在 `#faq` section 之前。

## 用户 / 产品视角验收步骤

1. 启动 Landing 本地预览。
2. 从上往下浏览主页面模块。
3. 确认“生态对比”位于“常见问题”前。

## 发布 / 部署方式

- 前端静态站点变更，按既有 landing 发布流程执行：

```bash
pnpm deploy:landing
```

## 影响范围 / 风险

- Breaking change：否。
- 风险：低，仅模块顺序调整。
