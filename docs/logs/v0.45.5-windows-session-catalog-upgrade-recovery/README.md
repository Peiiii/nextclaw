# Windows Desktop 会话目录升级恢复

## 迭代完成说明

- 根因一：Windows Desktop 0.47.0 会先把会话事件写入 JSONL journal 和消息 projection，再因 `node:sqlite` 严格命名参数绑定拒绝多余的 `deleted_at`，导致 SQLite catalog 缺少新会话或保留陈旧摘要。0.48.0 修复了后续事件写入，但启动初始化把 `migration_complete` 错当成 catalog 永久完整的证明，直接跳过 journal reconciliation，因此从旧版经过 0.47 再升级到 0.48 的用户仍可能看到空列表。
- 根因二：从官方 0.44.1 桌面端点击升级到官方 0.48.0 时，旧外壳使用 Node 20 启动下载的 0.48 runtime；该运行时会走 SQL.js 兼容路径，但 product bundle 没有包含 `sql-wasm.wasm`。NCP agent 因 `Cannot find module 'sql.js/dist/sql-wasm.wasm'` 无法 ready，最终整个 runtime 被外壳停止，所以会话接口拒绝连接、列表无法加载且消息无法发送。
- 确认方式：构造“空 catalog 已完成迁移，随后出现持久 journal”的真实 SQLite 状态；修复前升级实例返回空列表，复现与 Windows 用户反馈一致。
- 根因修复：Desktop product bundle 明确携带 SQL.js WASM，并让兼容数据库 owner 在包解析失败时定位同目录 bundle 资产；每次 kernel 启动还会使用现有轻量 journal summary 与 catalog 对账，补回缺失或陈旧记录。删除墓碑继续优先，残留 journal 不会复活已删除会话；UPSERT 只在字段确有差异时更新，避免正常启动产生整库 WAL 写放大。
- Windows Desktop CI 新增升级恢复门禁，打包前在 Windows Node 上执行迁移后孤立 journal、删除墓碑和严格 SQLite 命名参数测试。
- 同批次防复发治理：新增 `desktop-runtime-assets-v1` 资源声明合同，把 UI、templates、resources、bridge、WASM、worker/chunks、skills 和原生依赖的 source/target/平台条件收敛到一个 owner；构建复制与最终 ZIP 验证共享该合同，manifest 携带逐文件大小与 SHA-256 inventory，缺失、额外或被篡改的归档直接阻断构建/CI，不再依赖两份容易漂移的手写资源名单。

## 测试/验证/验收方式

- 修复前定向测试：1 项按预期失败，catalog 列表由期望的 1 条实际返回 0 条。
- 修复后定向测试：2 个测试文件、6 项全部通过，覆盖升级恢复、墓碑保护和正常事件写入。
- `@nextclaw/kernel` 全量测试：136 个测试文件、618 项全部通过。
- `@nextclaw/kernel` TypeScript 检查通过；全包 lint 为 0 error，保留 16 条既有 warning。
- Windows 2025 实机 CI `33536374327`（提交 `1dafc115e`）通过：官方 0.47.0 Desktop EXE 真实产生 `Unknown named parameter 'deleted_at'`，且 journal 已持久化。
- 同一 CI 将受影响目录固定为 `migration=complete catalog=missing journal=present` 后，官方 0.48.0 Desktop EXE 冷启动仍返回 `catalog=missing`；候选 EXE 在同一 home 冷启动后返回 `catalog=recovered messages=1`。
- 同一 job 的候选 Windows unpacked EXE 与 Portable archive 冒烟全部通过；Windows 定向 SQLite 测试为 2 个文件、6 项通过。
- Windows 2025 实机 CI `33543765684`（提交 `f905313a5`）进一步闭合用户报告的直接升级路径：官方 0.44.1 Desktop renderer 通过产品 API 下载并应用固定的官方 0.48.0 manifest，随后精确命中 `sql-wasm=missing runtime=not-ready`；候选 EXE 接管同一 home 后返回 `catalog=recovered messages=2`，再由原版 0.44.1 外壳启动候选 bundle 仍返回相同恢复结果。该 run 同时复验 0.47 → 0.48 catalog 缺失链路、候选 EXE 和 Windows Portable，全部通过。
- 主干 `desktop-validate` CI `33546199597`（提交 `601ee5d4b`）在 macOS、Windows 和 Linux 全部通过；Windows job `99984183233` 固定复现官方 0.44.1 → 0.48.0 的缺失 WASM 故障，并验证候选 runtime 在同一 home 和原版 0.44.1 外壳下恢复会话与消息。
- 正式 Desktop 发布 CI `33551958945`（发布提交 `5da5c3052`）通过 Windows x64/arm64、macOS x64/arm64 和 Linux x64 的构建、安装与实包冒烟；公开 Windows x64 bundle 反查确认包含 `bundle/runtime/dist/cli/app/sql-wasm.wasm`。
- 统一资源合同定向测试 5/5 通过，覆盖 file/tree/pattern/prepared-tree、Windows x64 专属资产与原生包规则，以及缺失、额外、篡改、目标错配、声明漂移、越界、冲突和空 pattern 失败路径。
- 统一资源合同的 macOS arm64 完整实包复验通过：最终 seed ZIP 为 45.8 MB，runtime 493/520 文件、11 个 extensions、54 个 plugin files、6 个精确 native packages；随后 runtime init、DMG 安装启动、`/chat` 加载和 bootstrap readiness 均成功。
- 统一资源合同提交 `7bfb635d7` 的全平台 `desktop-validate` run `33656218716` 全绿：runtime 3m25s、macOS DMG 4m39s、Windows installer 7m53s、Linux AppImage/deb/APT 9m58s、Windows EXE/Portable 13m15s。Windows job 再次真实复现已发布旧版升级故障并验证候选恢复，整次运行无需人工重试或介入。

## 发布/部署方式

- 通过主干 `desktop-validate` 的 Windows job 验证真实 Windows Node 行为。
- 验证通过后按稳定补丁发布流程统一发布 NPM、Runtime channel 与 Desktop stable bundle；不要求用户手工删除数据库或迁移文件。
- 当前状态：NextClaw `0.48.1` 与 Desktop `v0.48.1-desktop.1` 已稳定发布；NPM、四平台 Runtime、五平台 Desktop、稳定升级 manifest 和 Linux APT 均完成发布与反查。
- 资源合同属于内部发布防线，不改变 0.48.1 的用户可见修复或 bundle 路径协议；合入后由后续每次 Desktop 构建和发布自动执行，无需为该治理改动单独发布新安装包。

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
- 同批次资源治理删除 build service 和 package verifier 的专用复制/验证名单，统一由 config + executor/verifier owner 消费。最终 Review 为 no findings，新代码治理全通过；自动检查仅提示共享 utils 为 407/500 行、package verifier 为 495/500 行，后者已由 573 行下降，当前继续拆分会增加跨文件跳转而没有新变化轴。

## 红区触达与减债记录

### packages/nextclaw-kernel/src/stores/ncp-agent-session-summary-index.store.ts

- 本次是否减债：是。
- 说明：删除“迁移完成即永久跳过对账”的错误捷径，让 journal 事实源与 SQLite 投影恢复合同一致，并消除无差异 UPSERT 的写放大。
- 下一步拆分缝：文件超过 400 行预算前，将 schema/migration SQL 与运行期查询写入拆到现有 store 子 owner；本次不为 5 行净增长提前新增 wrapper。

## NPM 包发布记录

- `@nextclaw/kernel@0.15.1`：patch，修复 Desktop 升级后的会话目录恢复，已随 NextClaw `0.48.1` 发布。
- `nextclaw@0.48.1`：已发布并设为 NPM `latest`；Windows、Linux、macOS x64/arm64 的 Node 20/22/24/26 兼容矩阵全部通过。
- `v0.48.1-desktop.1`：已发布为 Latest Desktop Release，包含 Desktop `0.0.280` 的 Windows、macOS、Linux 安装与便携资产，以及五个平台的签名 product bundle 和 stable manifest。
- 本次统一资源合同治理：不涉及 NPM 包发布，也不单独触发 Desktop 版本发布；它保护后续所有 Desktop product bundle 构建。
