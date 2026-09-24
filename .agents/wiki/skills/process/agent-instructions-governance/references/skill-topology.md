# Skill 拓扑与创建门

## 工作拓扑

- **Workflow root**：一个稳定工作域的流程、状态、返工和完成 owner。普通开发当前只有 `development-lifecycle`；运营、内容或研究只有形成共同生命周期证据后才新增 root。
- **阶段 owner**：回答 workflow 中一个稳定环节怎样做好。开发的 Task Understanding、Design、Implementation、Validation、Review、Delivery、Retrospective 各有一个 `development-*` owner；只有需要被用户直接选择或参与初始路由时才占发现入口。
- **独立任务入口**：没有适用 workflow root、又能独立回答任务如何开始和结束的重复用户意图。未来共同生命周期成立时可下沉为新 root 的阶段或方法。
- **下级 Wiki Skill**：不需要参与初始发现、但仍有独立可复用合同的场景能力，或被两个以上入口复用的规范、检查表和配套脚本，进入 `.agents/wiki/skills/<group>/<skill>/SKILL.md`；保留完整 Skill frontmatter 和资源。
- **共享知识**：事实、背景、术语、案例和权威来源索引进入 `.agents/wiki/knowledge`；不拥有流程、状态、授权或指令优先级。
- **单 owner 条件材料**：只由一个 skill 使用的场景细节进入该 owner 的 `references/`。

顶层表示发现责任，不表示重要性。下沉原 Skill 时保留叶子目录的 `SKILL.md`、frontmatter、references 和 scripts，只把它移动到 `wiki/skills` 的明确领域分组；更新唯一父路由、commands、脚本与测试，禁止兼容软链接或双副本。分组目录只是 namespace，不是 workflow owner，也不能成为新的平铺垃圾桶。

## Skill 创建门

只有同时满足才创建新的顶层或下级 Skill：

- 没有现有 owner；
- 有可重复场景和独立流程、判断或资源合同，而不是原则换名；
- 独立 Skill 比扩展现有 owner、写单 owner Reference、确定性脚本或普通知识更清晰；
- 能说明触发条件、退出条件、owner 和验证方式。

## 顶层提升门

创建 Skill 后，只有同时满足才进入 `.agents/skills`：

- 对应明确、稳定且需要直接命中的用户意图；
- 不能可靠地由已有 workflow root、阶段或独立入口显式路由；
- description 能与相邻顶层 Skill 互斥；
- 参与初始发现的收益高于每轮 description、路径和选择干扰成本；
- 提升后仍满足仓库 discovery 预算。

未满足创建门时合并、写 Reference、脚本、Wiki knowledge 或删除；满足创建门但未满足顶层提升门时进入分组 Wiki Skill。多个独立任务只有已共享状态与阶段时才提升为新 workflow root，不能为了目录整齐提前发明 `*-lifecycle`。
