# Projects kernel boundary

- 本目录拥有 Projects 的产品语义、工作项持久化合同和有界项目材料查询；不要把这些逻辑下沉到 server、service 或 UI。
- Projects 只从 Project Store 读取项目身份、从 Project Work 读取产物关联，并按固定约定读取根 `AGENTS.md` 与 `.agents/skills`；不得读取专用项目配置、扫描全部会话或遍历目录猜测产物。
- 同一事实只保留一条解析与合并主链路。新增抽象层前必须证明它隔离了真实变化点；不要以 wrapper、adapter、manager 的名义复制合同。
- 项目材料缺失使用明确空态；真实读取错误向调用方暴露，不得用兼容 fallback、推测值或隐式写入伪装成功。
- `ProjectWorkManager` 是工作项、状态、历史和 artifact 关联的唯一写入 owner；数据存放在 NextClaw data 目录，不得向项目目录写入工作追踪文件、Skill 或配置。
- 工作项变更先事务提交，再发布 `project.work.changed` 通知；消费者按需查询当前投影，不通过扫描或重放历史事件重建状态。
