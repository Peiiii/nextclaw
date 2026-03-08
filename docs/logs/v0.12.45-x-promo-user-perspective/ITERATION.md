# v0.12.45 x promo user perspective

## 迭代完成说明（改了什么）

- 将 X 宣传文案改写为用户视角，不再以技术实现为主叙事。
- 重点改为用户可感知收益：安装更稳、搜索更快、使用更可预期。
- 在同一文件补充三档可直接投放版本：
  - 推荐发布文案（稳重）
  - 备选精简版
  - 备选口语版
- 更新文件：
  - [X 宣传文案](../../marketing/2026-03-08-x-24h-progress-steady.md)

## 测试/验证/验收方式

- 文案可读性校验：
  - 人工检查是否以“用户收益”开头，且首屏不出现底层技术术语堆叠。
- 事实一致性校验：
  - `node -p "require('./packages/nextclaw/package.json').version"`
  - `node -p "require('./packages/nextclaw-core/package.json').version"`
  - `node -p "require('./packages/nextclaw-server/package.json').version"`
  - `node -p "require('./packages/nextclaw-ui/package.json').version"`
- 本次仅文档文案改写，无代码逻辑变更，`build/lint/tsc` 不适用。

## 发布/部署方式

- 本次为营销文案更新，无需发布包、部署服务或执行 migration。
- 从文案文件中按需选择一个版本，直接用于 X 发布。

## 用户/产品视角的验收步骤

1. 打开 [X 宣传文案](../../marketing/2026-03-08-x-24h-progress-steady.md)，确认内容先讲用户收益，再讲版本信息。
2. 选择一个版本（稳重/精简/口语）直接粘贴到 X，检查是否可在单条贴文中完整表达。
3. 发布后观察互动评论，确认用户反馈聚焦“更稳、更快、更省心”而非技术细节。

