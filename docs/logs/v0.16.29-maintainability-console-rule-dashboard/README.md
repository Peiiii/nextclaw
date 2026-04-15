# v0.16.29 Maintainability Console Rule Dashboard

## 迭代完成说明

- 扩展 `apps/maintainability-console` 的后端 overview 数据源，新增 `AGENTS.md` 规则书解析，把 `Rulebook` 与 `Project Rulebook` 直接转成结构化 dashboard 数据，而不是继续把规则留在长文档里靠人工翻找。
- 新增 `apps/maintainability-console/server/agents-rulebook.service.ts` 作为规则解析 owner，统一负责章节抽取、字段归一化、section/owner 汇总与完整度统计，避免把文档解析散落到 React 或现有 metrics service 中。
- 扩展前端治理区，让页面除了目录压力、维护性热点、扫描口径之外，还能显示“治理规则 / 项目规则 / 责任人 / 模板完整度”等概览卡片、section 汇总、owner 分布，以及可展开浏览的“规则字典”。
- 顶部概览卡片同步新增“治理规则”“项目规则”，让整个控制台从“代码量大盘”升级为“代码压力 + 治理契约”的 dashboard。
- 更新 `apps/maintainability-console/scripts/smoke.test.mjs`，把“规则总览”“规则字典”纳入真实页面冒烟断言。
- 相关历史迭代：[`docs/logs/v0.15.96-maintainability-console-local-dashboard/README.md`](../v0.15.96-maintainability-console-local-dashboard/README.md)

## 测试/验证/验收方式

- `pnpm -C apps/maintainability-console lint`
- `pnpm -C apps/maintainability-console tsc`
- `pnpm -C apps/maintainability-console build`
- `pnpm -C apps/maintainability-console smoke`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`

结果说明：

- `pnpm -C apps/maintainability-console lint` 通过。
- `pnpm -C apps/maintainability-console tsc` 通过。
- `pnpm -C apps/maintainability-console build` 通过，前端与服务端构建成功。
- `pnpm -C apps/maintainability-console smoke` 通过，页面能看到“规则总览”“规则字典”等新增面板。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs` 未全绿，但本轮与 `maintainability-console` 相关的新错误已清零；剩余 error 来自工作区其它并行改动中的 `packages/nextclaw-ui/src/components/chat/ChatSidebar.tsx`。
- `pnpm lint:new-code:governance` 未通过，阻塞点来自工作区里其它已触达文件的历史命名治理问题：`packages/nextclaw-ui/src/components/chat/ChatConversationPanel*.tsx`、`ChatSidebar*.tsx` 不是 kebab-case；本次新增/修改的 `maintainability-console` 文件未新增这类命名错误。
- `pnpm check:governance-backlog-ratchet` 未通过，失败原因是仓库既有 `docFileNameViolations` 为 `13`，高于 baseline `11`；该阻塞与本次 dashboard 改动无直接关系。

## 发布/部署方式

- 本次仍是本地研发工作台增强，不进入线上发布链路。
- 本地开发：在仓库根运行 `pnpm dev:maintainability:console`，或直接运行 `pnpm -C apps/maintainability-console dev`。
- 本地验证：在仓库根运行 `pnpm -C apps/maintainability-console build && pnpm -C apps/maintainability-console start`，然后访问本地端口查看页面。
- 若只需增量检查规则解析，可运行 `pnpm -C apps/maintainability-console exec tsx -e "import { resolve } from 'node:path'; import { AgentsRulebookService } from './server/agents-rulebook.service.ts'; const service = new AgentsRulebookService(resolve(process.cwd(), '../..')); console.log(service.getOverview().totalCount);"`

## 用户/产品视角的验收步骤

1. 在仓库根执行 `pnpm dev:maintainability:console`。
2. 打开 `http://127.0.0.1:5180`。
3. 确认顶部概览卡片除了“代码行数 / 跟踪文件 / 模块数 / 扫描耗时 / 目录热点 / 维护热点”外，还新增“治理规则”“项目规则”。
4. 向下滚动，确认可看到“规则总览”面板，里面能显示总规则数、项目规则数、责任人数量、模板完整度，以及通用规则 / 项目规则的 section 汇总。
5. 确认可看到“规则字典”面板，按 `Rulebook` / `Project Rulebook` 分区展示规则卡片。
6. 任意展开一条规则，确认能看到“执行方式”“示例”“反例”。
7. 切换 `Repo Volume` 或点击 `刷新数据`，确认规则面板仍会随整个大盘一起正常渲染。

## 可维护性总结汇总

- 可维护性复核结论：保留债务经说明接受
- 本次顺手减债：是

### 长期目标对齐 / 可维护性推进

- 这次不是简单往大盘里塞一块新卡片，而是把“代码体量观测”和“治理契约观测”收敛到同一个入口里，让 NextClaw 作为研发操作层的治理认知更统一，也更接近“一个入口看到系统怎么约束自己”的方向。
- 我优先选择复用现有 `AGENTS.md` 作为单一真相源，没有新造 rules JSON、没有复制第二套治理配置；同时把文档解析收敛到单独的 `AgentsRulebookService`，避免前后端都各写一套解析逻辑。
- 实现中顺手处理了一次维护性提醒：最初新增两个顶层 component 文件触发了 `apps/maintainability-console/src/components` 目录预算告警，随后把规则展示逻辑收敛到 `src/components/governance/` 子目录，既避免顶层继续摊平，也把 `governance-panels.tsx` 的异常增长压回去。

### 代码增减报告

- 新增：646 行
- 删除：17 行
- 净增：+629 行

### 非测试代码增减报告

- 新增：644 行
- 删除：17 行
- 净增：+627 行

### 可维护性总结

- 本次是否已尽最大努力优化可维护性：是。在满足“规则可浏览、可统计、可钻取”这个新能力的前提下，已经把增长压到“一个解析 service + 一个治理子目录组件 + 类型与样式扩展”的最小必要结构，没有复制治理真相源，也没有引入额外 store、缓存层或后端持久化。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。方案上优先复用 `AGENTS.md`，并在实现中删除了最初为了快速推进而产生的两个顶层组件文件，改为收敛进单个治理子目录组件，避免目录继续平铺。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：总代码量净增，这是因为新增了“规则 dashboard”这条用户可见能力；但目录平铺度没有继续恶化，反而通过 `components/governance/` 子目录偿还了本次实现中暴露出的平铺债务。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：是。后端以 `AgentsRulebookService` 负责规则文档解析，`MaintainabilityDataService` 只负责汇总 overview；前端把规则展示限定在治理子目录组件里，避免把解析/展示耦合回已有热点面板。
- 目录结构与文件组织是否满足当前项目治理要求：基本满足。`maintainability-console` 侧新增内容已按 `server / shared / src/components/governance` 分层；本次守卫里剩余错误不在该 app，而在工作区其它并行改动文件。
- 若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：已执行独立复核。
- no maintainability findings
- 保留债务与下一步入口：当前主要剩余 watchpoint 是 `apps/maintainability-console/src/index.css` 与规则展示组件后续可能继续膨胀；如果后面再加筛选、搜索、图表化维度，优先从 `governance/` 子目录内部继续拆，不要再把交互状态或解析逻辑回卷到 `governance-panels.tsx` 或全局样式平面里。
