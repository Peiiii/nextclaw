## 子树边界豁免

- 原因：`tool-provider/providers/` 受 contribution role contract 约束，每个 `ToolProvider` class 需要独立文件表达一个稳定的工具来源 owner；这些文件均由上层 `ToolProviderContribution` 显式装配，没有形成第二层 feature 或隐藏注册机制。

## 目录预算豁免

- 原因：该目录直接文件均为同一种 `*.provider.ts` 扩展点角色。继续保持扁平结构能让工具来源与注册顺序被一次审阅；按业务名拆出只有单文件的子目录会制造空层，合并 Provider 又会混淆工具 owner。
