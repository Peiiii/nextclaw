# Scripts

仓库级脚本统一放在该目录，但不再允许长期以根目录平铺堆积。

## 当前结构

- `scripts/governance/`: 命名治理、目录预算、maintainability hotspots、拓扑与治理报告
- `scripts/release/`: release check、发布校验、README 同步、published tag 同步
- `scripts/release/check/`: release batch check 的内部 planner / scheduler / steps
- `scripts/dev/`: 仓库级开发入口、dev runner、dev 状态查看、docker 启动
- `scripts/smoke/`: 真实运行链路 smoke、平台与远程链路验证
- `scripts/docs/`: 文档校验与产品截图刷新
- `scripts/desktop/`: desktop 打包、验证、APT 仓库辅助
- `scripts/metrics/`: 代码体量与 LOC 指标
- `scripts/deploy/`: 仓库级 deploy 脚本
- `scripts/local/`: 本地安装与本地插件开发辅助
- `scripts/project-pulse/`: 项目脉搏数据生成
- `scripts/shared/`: 仓库根路径发现等跨子树共享基础能力

## 根目录约束

- 根 `scripts/` 默认只保留 `README.md` 与职责明确的子目录。
- 新增仓库级脚本时，必须先归类到已有子树；若没有合适分组，先补目录结构，再新增脚本。
- 不保留 root-level 兼容 shim；根 `package.json`、技能、工作流与文档应直接引用真实子路径。
- 仓库级脚本禁止继续按目录层级硬编码猜测 repo root；统一通过 `scripts/shared/repo-paths.mjs` 解析工作区根，避免目录重组后批量失效。

## 本轮治理结果

- 根 `scripts/` 的直接文件数已从 `92` 降到 `1`。
- 这次治理的核心目标是降低目录平铺度和导航成本，同时保持脚本行为与命令入口稳定。
