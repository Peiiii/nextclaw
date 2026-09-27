# Bibo Personal Agent 大型交付执行计划

- 上位合同：[验收合同](../work/2026-09-25-bibo-personal-agent/acceptance-contract.md)，scope-revision `4`；[可执行设计](../designs/2026-09-25-bibo-personal-agent-implementation-alignment.design.md)。当前状态见[唯一工作记录](../work/2026-09-25-bibo-personal-agent/working-notes.md)。
- 目标：在正式 Bibo 应用闭合 BIBO-01～13。外部账号集成被用户排除；用户已明确授权并要求 Bibo 产品提交、合入主干、推送和正式远程部署，最终以线上链路验证完成交付。
- 顺序是实现依赖，不拆整体验收阶段。每个部分只关闭相应机制风险，不能独立宣称整体交付。

| 顺序 | owner 与输入 | 可观察结果／适用合同 | 设计策略与证明 |
| --- | --- | --- | --- |
| 1 | Worker DO、Runner、领域模块；现有单会话与快照链路 | 多会话 CRUD、独立网页写入与 Agent 写入都能持久恢复；BIBO-02/07/08/10 | 复用上位设计；先以契约测试证明账号串行、版本冲突、快照失败，运行匹配 tsc。若 R2 测量不支持整包快照，回 Design 决定物理粒度。 |
| 2 | Bibo client/store/UI；真实 API | 概览、对话、收件箱、日／周／月日程、任务、笔记、文件及右侧区在桌面和手机打通；BIBO-01～06/09 | 月历按显示范围向服务端读取全部事件，日期格展示安排且可进入当天完整议程；交互细节按真实浏览器批次审查，不借概念 localStorage。 |
| 2a | `@nextclaw/personal-agent-ui` 与业务页面；已有 token 和重复控件 | 公共 API 与样式去品牌化；按钮、表单、分段切换、列表行、空状态、反馈由组件体系承载，业务页面实际消费；BIBO-12 | 同级操作迁移后删除局部重复规则；检查 hover、焦点、选中、禁用及窄屏，品牌由应用注入，业务状态不迁进组件库。 |
| 3 | 跨入口集成、用户文档、发布准备 | 黄金链路、失败恢复、隔离、容量和体验证据覆盖所有 Required；BIBO-01～12 | 发现模型缺口回 Design，偏差回 Implementation；Validation、Review 后才进入交付。外部操作按实际授权处理。 |
| 2b | 公共交互与各模块；工作记录 UI-00～07 | 弹层/操作图标/状态统一，七个模块分别对标成熟产品并关闭实际差距；BIBO-09/12 | 先共用行为，再迁移真实页面；每项记录参考、差距、取舍和桌面/手机证据，不仅建立未被使用的组件。 |
| 4 | 冻结远程主干及 Cloudflare 正式环境 | 合入并推送主干，部署 app.bibo.bot，真实线上链路通过；BIBO-13 | 记录源码 SHA/部署版本，执行上线验证及主线回收；不以本地预览结束交付。 |

部分完成／跨上下文恢复只读上述[工作记录](../work/2026-09-25-bibo-personal-agent/working-notes.md)的当前状态，再按合同和设计核对开放 ID；历史证据留在[日志](../logs/2026-09-25-bibo-personal-agent/README.md)。不从最新 commit 或概念演示推断完成。
