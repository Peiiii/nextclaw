# Skill 拓扑与创建门

## 入口分类

- **标准流程 owner**：普通开发只能有一个；具体入口由当前 `AGENTS.md` 的默认开发路由声明，不在其它 skill 重复写死名称。
- **阶段 owner**：Task Understanding、Design、Implementation、Validation、Review、Delivery、Retrospective 各有一个 `development-*` owner，只在进入该阶段后加载。
- **完整场景 owner**：发布、长期治理、外部系统交付等能独立回答“用户要完成什么任务”的闭环才保留入口。
- **工艺与场景规范**：只回答“当前阶段怎样判断/实现/验证”的通用原则或项目细节进入所属 owner 的条件 reference，不占平行入口。

Reference 也要区分通用工艺与项目场景，文件名和加载条件应直接表达类别；不要把已删除 skill 的 frontmatter 原样搬入 reference。

## 创建门槛

只有同时满足才创建 Skill：

- 没有现有 owner；
- 有明确、可重复的用户意图；
- 有独立流程或稳定合同，而不是原则换名；
- description 能与相邻 skill 互斥；
- 新入口比 reference 或扩展现有 owner 更清晰。

否则合并、写 Reference 或删除。
