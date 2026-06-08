# Governance Scripts

仓库治理与可维护性脚本统一收敛在该目录。根目录只保留说明文档；可执行脚本按职责进入子树，避免 `scripts/governance` 再次变成平铺混杂目录。

## 目录结构

- `checks/`：diff-only lint gate 与总治理入口。
- `shared/`：治理脚本共享 helper、contract 与 baseline 路径常量。
- `backlog/`：治理 backlog baseline 与 ratchet 检查。
- `maintainability/`：维护性报告、热点、目录预算与 ESLint 覆盖报告。
- `reports/`：人工查看用报告命令。
- `topology/`：拓扑治理图与报告。
- `module-structure/`：模块结构 contract 与结构漂移检查。
- `eslint-rules/`：仓库自定义 ESLint 规则。

新增治理能力时，优先落到已有职责子树；只有出现稳定、可复用的新职责类别时，才新增子树。
