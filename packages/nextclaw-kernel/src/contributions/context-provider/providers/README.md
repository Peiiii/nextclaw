## 子树边界豁免

- 原因：`context-provider/providers/` 受 contribution role contract 约束，只允许直接放置 `*.provider.ts` 文件；同时每个 `ContextProvider` class 需要独立文件表达 owner，不能退回聚合大文件。该目录的直接文件均为同一 provider role，注册顺序由上层 contribution 显式管理。

## 目录预算豁免

- 原因：`context-provider/providers/` 受 contribution role contract 约束，只允许直接放置 `*.provider.ts` 文件；同时每个 `ContextProvider` class 需要独立文件表达 owner，不能退回聚合大文件。该目录的直接文件均为同一 provider role，注册顺序由上层 contribution 显式管理。
