# 迭代完成说明

- 修复 `post-edit-maintainability-guard` 在未跟踪 `docs/logs/v<semver>-<slug>/` 目录场景下无法识别本次迭代 `README.md` 的问题。
- 新增 `extractChangedIterationReadmes(...)` 纯函数，统一处理显式传入路径与 `git status --porcelain` 输出中的目录/文件两类输入。
- 调整 guard core，将原始 `--paths` 一并传给 hotspot 检查，避免用户已经显式传入迭代 `README.md` 却仍被忽略。
- 补充针对“显式 README 路径”“未跟踪迭代目录”“非迭代路径”的回归测试。

# 测试/验证/验收方式

- 运行 `node --test .codex/skills/post-edit-maintainability-guard/scripts/maintainability-guard-hotspots.test.mjs`
- 运行 `node .codex/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths .codex/skills/post-edit-maintainability-guard/scripts/maintainability-guard-hotspots.mjs .codex/skills/post-edit-maintainability-guard/scripts/maintainability-guard-core.mjs .codex/skills/post-edit-maintainability-guard/scripts/maintainability-guard-hotspots.test.mjs`
- 手工验收点：未暂存但已创建的 `docs/logs/v<semver>-<slug>/README.md` 不应再因为 `git status` 只显示目录而被 guard 漏检。

# 发布/部署方式

- 本次仅涉及仓库内维护性检查脚本与测试，无独立部署动作。
- 随正常代码提交流程进入主分支即可生效。

# 用户/产品视角的验收步骤

1. 在 `docs/logs` 下新建一个未跟踪的 `v<semver>-<slug>` 目录，并放入 `README.md`。
2. 触达一个红区文件，同时执行 `check-maintainability.mjs`。
3. 若对应 `README.md` 中已经写入红区触达记录，guard 不应再报“缺少 changed iteration README”这类误判。
4. 若 `README.md` 缺字段，guard 应继续稳定报出缺失字段，而不是因为目录未暂存导致完全找不到 README。
