# Skill 发现分层迁移计划

日期：2026-09-10

状态：已完成（主干交付）

上位设计：[AI 开发体系 Skill 发现分层](../designs/2026-09-10-skill-discovery-hierarchy.design.md)

## 目标与非目标

把 repo 顶层 skill 从 37 个收敛到 15 个，建立 `.agents/wiki/{skills,knowledge}`，修复 discovery 成本检查和所有引用。首批不重写各下级 Skill 的正文、不批量搬运项目 docs、不改变产品运行行为；最终 Git 交付以用户后续授权为准。

## 执行部分

1. **结构合同与路由**：新增 wiki 边界说明，更新 AGENTS、流程/阶段 skill 和 commands，使每个下级 Skill 仍有唯一入口。验证 Markdown 链接和名称引用。
2. **资产迁移**：按设计映射整体移动 22 个目录到 `wiki/skills/<group>`，保留完整 `SKILL.md`、frontmatter、references/scripts 相对结构；更新脚本调用路径。
3. **治理检查**：把检查从 description-only 预算改为 discovery 代理预算，增加下级 Skill 分组、非发现性与不回流断言，更新单元测试。
4. **验收与 Review**：运行 skill progressive-loading 测试、检查、适用治理 ratchet和 diff-only maintainability；对照 15 个入口、路由和断链场景审查。
5. **知识与留痕**：更新 2026-09-08 开发体系设计的后续链接和既有 `v0.48.12-ai-development-system` 记录，不新建版本型日志目录。

## 恢复入口

中断后以本计划、设计中的 22 项映射、`git status --short` 和 `pnpm check:skill-progressive-loading` 恢复。若部分移动完成，先用 `rg` 修复所有旧 `.agents/skills/<downshifted>/` 路径，再运行检查；不得创建兼容软链接掩盖断链。

每部分复用上位设计；新证据若改变顶层保留门或 wiki 权威边界，先返回设计并同步本计划。

## 完成结果

- 顶层发现入口由 37 个收敛为 15 个；22 个完整 Skill 下沉到 `.agents/wiki/skills` 的六个分组，并建立 `.agents/wiki/knowledge` 及首个 Codex 发现机制知识条目。
- discovery 代理字符由 6,914 降为 2,726，description 由 3,982 降为 1,392，顶层 `SKILL.md` 总量由 161,009 字节降为 71,261 字节。
- 检查器已覆盖 discovery 预算、Wiki Skill 分组/frontmatter/非发现性、下沉 Skill 不回流、链接、开发流程骨架和验收合同；拓扑常量与审计执行分文件维护。
- 定向测试、治理检查、遥测脚本测试和 marketplace 校验均通过。release action 测试当前为 12/15，3 项失败来自迁移前已存在的 workflow/发布 Skill 断言漂移，本计划只更新读取路径，没有改动发布语义。
- 本次不涉及产品运行行为、用户文档站、changeset、产品发布或部署；按用户明确授权提交并推送主干。
