# Windows Desktop 会话目录升级恢复

## 迭代完成说明

- 根因：Windows Desktop 0.47.0 会先把会话事件写入 JSONL journal 和消息 projection，再因 `node:sqlite` 严格命名参数绑定拒绝多余的 `deleted_at`，导致 SQLite catalog 缺少新会话或保留陈旧摘要。0.48.0 修复了后续事件写入，但启动初始化把 `migration_complete` 错当成 catalog 永久完整的证明，直接跳过 journal reconciliation，因此从旧版经过 0.47 再升级到 0.48 的用户仍可能看到空列表。
- 确认方式：构造“空 catalog 已完成迁移，随后出现持久 journal”的真实 SQLite 状态；修复前升级实例返回空列表，复现与 Windows 用户反馈一致。
- 根因修复：每次 kernel 启动都使用现有轻量 journal summary 与 catalog 对账，补回缺失或陈旧记录；删除墓碑继续优先，残留 journal 不会复活已删除会话。UPSERT 只在字段确有差异时更新，避免正常启动产生整库 WAL 写放大。
- Windows Desktop CI 新增升级恢复门禁，打包前在 Windows Node 上执行迁移后孤立 journal、删除墓碑和严格 SQLite 命名参数测试。

## 测试/验证/验收方式

- 修复前定向测试：1 项按预期失败，catalog 列表由期望的 1 条实际返回 0 条。
- 修复后定向测试：2 个测试文件、6 项全部通过，覆盖升级恢复、墓碑保护和正常事件写入。
- `@nextclaw/kernel` 全量测试：136 个测试文件、618 项全部通过。
- `@nextclaw/kernel` TypeScript 检查通过；全包 lint 为 0 error，保留 16 条既有 warning。
- Windows 2025 实机 CI `33536374327`（提交 `1dafc115e`）通过：官方 0.47.0 Desktop EXE 真实产生 `Unknown named parameter 'deleted_at'`，且 journal 已持久化。
- 同一 CI 将受影响目录固定为 `migration=complete catalog=missing journal=present` 后，官方 0.48.0 Desktop EXE 冷启动仍返回 `catalog=missing`；候选 EXE 在同一 home 冷启动后返回 `catalog=recovered messages=1`。
- 同一 job 的候选 Windows unpacked EXE 与 Portable archive 冒烟全部通过；Windows 定向 SQLite 测试为 2 个文件、6 项通过。

## 发布/部署方式

- 通过主干 `desktop-validate` 的 Windows job 验证真实 Windows Node 行为。
- 验证通过后按稳定补丁发布流程统一发布 NPM、Runtime channel 与 Desktop stable bundle；不要求用户手工删除数据库或迁移文件。
- 当前状态：Windows 真实复现与候选修复验证已闭环，待稳定补丁发布。

## 用户/产品视角的验收步骤

1. 在隔离 Windows Desktop home 中启动 0.47.0，形成已完成迁移的 SQLite catalog。
2. 模拟 0.47 故障窗口：保留有效 journal/projection，但让 catalog 缺少对应会话记录。
3. 升级到补丁版本并重启 Desktop，不执行手工导入或数据库删除。
4. 确认会话列表自动恢复，消息历史可读取，已有删除墓碑对应的会话仍保持删除。
5. 创建新会话并发送消息，重启后再次确认列表和消息持久存在。

## 可维护性总结汇总

- 修复复用既有 journal、projection、catalog 和 `reconcileRecords` owner，没有新增平行恢复 service、fallback 数据源或 Windows 专用产品逻辑。
- 启动扫描优先读取轻量 projection；SQL conflict update 增加 null-safe 差异条件，正常记录不产生无意义重写。
- diff-only maintainability 检查 0 error；唯一 warning 为 `ncp-agent-session-summary-index.store.ts` 当前 388 行、接近 400 行预算。本次非测试代码净增集中在同一 SQLite owner，未达到拆分阈值。
- 新增 changeset 与迭代路径通过 planned-path preflight；现有设计文档同步补充升级恢复合同。

## 红区触达与减债记录

### packages/nextclaw-kernel/src/stores/ncp-agent-session-summary-index.store.ts

- 本次是否减债：是。
- 说明：删除“迁移完成即永久跳过对账”的错误捷径，让 journal 事实源与 SQLite 投影恢复合同一致，并消除无差异 UPSERT 的写放大。
- 下一步拆分缝：文件超过 400 行预算前，将 schema/migration SQL 与运行期查询写入拆到现有 store 子 owner；本次不为 5 行净增长提前新增 wrapper。

## NPM 包发布记录

- `@nextclaw/kernel`：patch，修复 Desktop 升级后的会话目录恢复；当前未发布，待统一稳定补丁发布。
