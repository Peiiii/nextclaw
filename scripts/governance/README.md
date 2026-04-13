# Governance Scripts

仓库治理与可维护性脚本统一收敛在该目录。

## 目录预算豁免

- 原因：该目录当前同时承载 diff-only lint gate、报告脚本、共享 helper、baseline 数据与少量规则测试入口。它已经从仓库根 `scripts/` 平铺态收敛出单独治理子树，但内部仍处于过渡阶段；本轮先优先消除根目录巨石问题与运行链路断点，后续再继续拆到 `lint/`、`report/`、`shared/`、`eslint-rules/` 等更细分子树，避免在同一轮把路径震荡扩大到整个治理链路。
