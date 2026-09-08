# 开发流程与四项聊天问题交付计划

- contract-id: chat-quality-20260908；parent-goal：按风险自主验收开发流程改进及 NC-169、NC-167、NC-170、NC-168，每项完成后合入本地 master。
- task-id: dt-8c4a17b2；scope-revision: 1；scope-confirmation: user-confirmed。
- 工作区：`/Users/peiwang/Projects/nextbot-chat-quality-four-fixes`；分支：`codex/chat-quality-four-fixes`；初始主干：`f71eee632`。
- 授权：单 Agent，自主设计/验收、提交和本地合并；不推送、不发布、不重启现有实例。主工作区未跟踪的 contributor plan 属其他任务。

## 执行顺序与设计策略

1. 流程治理（L0）：现有 lifecycle 已有风险、契约和完成门；仅在 design 增加冻结前自审，在 validation 消除 L2 双证据机械重复并明确无人值守证据选择。不增加 owner、脚本、常驻规则或拓扑。轻量内联设计，无独立设计文档。
2. NC-169（预期 L1）：调查真实消息组件及响应式布局；单路径则跳过独立设计，验证实际移动/桌面布局，提交合入。
3. NC-167（预期 L2）：沿耗时 producer → 投影/适配 → UI 取证；状态或持久化合同变化前补稳定设计；修前复现、修后边界验证，提交合入。
4. NC-170（预期 L3）：追踪运行结束到 UI 的完整链路；实现前补稳定设计与时序验收；不以提前标记完成掩盖后台工作，提交合入。
5. NC-168：复用已有[设计](../designs/2026-09-06-mobile-realtime-recovery.design.md)和[交付证据](../logs/v0.48.7-nc-168-mobile-realtime-recovery/README.md)。主干已有 e6de142d0 修复，不重复开发；核对当前代码与恢复边界，发现实质缺口才进入修复。

每项按最小充分验证、自审、精确提交和本地合并完成闭环，再进入下一项。设计、验证和变更证据在对应阶段补全，不预设计未知根因。

## Active acceptance ledger

| ID | Required | 合同 | Status | 当前证据 |
| --- | --- | --- | --- | --- |
| FLOW | true | 设计有针对性自审；验证按真实风险选最低充分证据；不新增重型默认流程 | passed | progressive-loading、governance ratchet、diff 检查通过；内容自审无 findings；38 skills/37 edges/4368 description chars 不变，入口净增 20 字节 |
| NC-169 | true | 手机用户头像及占位消失，消息宽度自然；桌面与助手布局正常 | passed | Chrome 375/767/768/1280px 实际共享组件及产品 CSS：用户占位 0/0/32/32px，助手均 32px，无溢出；截图已检查；tsc、lint、governance、maintainability 通过 |
| NC-167 | true | 完成消息显示正确耗时，已有持久化数据刷新可恢复，失败/运行态不混淆 | passed | MessageCompleted→RunFinished/Error 修前 2 失败、修后通过；UI 组装 summary 与 kernel journal 冷重载/分页通过；三包 tsc、lint 与治理通过 |
| NC-170 | true | 真实结束及时反映至 UI；仍在执行时不错误标记完成；重进会话状态一致 | passed | stale-cache 修前失败、修后通过；真实 toolkit/React 正反时序与 hydration/controller 59 用例通过；UI tsc/lint/维护性与治理通过 |
| NC-168 | true | 假活连接在页面/网络恢复时重建并同步状态，不重复提交请求或消息 | passed | 真实旧 transport 代码 2 失败、当前通过；连续两次恢复及远程 pending 不重放；Chrome 实际 WS 两次断网，3 个独立恢复事件、草稿保留；32 UI + 9 HTTP client 用例通过 |
| LOCAL | true | 每项新改动验证后提交并合入本地 master，保留他人 WIP，不推送 | not-run | 待逐项记录 SHA |

删除噪声标准：不要求每项全仓测试、多浏览器截图或真实模型调用；这些与局部 CSS/显示逻辑风险不对应。真实手机与运营商组合不能由桌面模拟声称覆盖，不将环境抽样冒充所有设备保证。

## 当前阶段、事实与恢复入口

- 当前：NC-168 验证已通过，补强测试提交合入后执行整体完成门。NC-170 `55a63199a`、NC-167 `a9fcbd968`、NC-169 `665b10425` 已本地合入。NC-169 为 L1 small-change，skip-design/design-document: not-required，单一 avatar 展示 owner，无状态变化；纯视觉无 CLI 适用入口。
- NC-167：L3 bugfix，设计见[完成时序](../designs/2026-09-08-chat-completion-timing.design.md)，稳定设计自审无模型缺口；toolkit 同一 owner 根据明确 ID 补全终态时间，UI 不猜值。无新增用户操作，CLI 不适用。用户文档、changeset 与[迭代](../logs/v0.48.9-chat-quality-acceptance/README.md)已同步。主观复核无 findings，600 行原预算不恶化，纯定位归既有 utils。
- NC-169 review：无 findings；原有目录 17/12 预算例外未恶化。临时浏览器 harness 已清理，截图保留于工作区 `.local/chat-quality/nc169-mobile.png`，不作对外产品截图。
- 用户再次强调：故障必须构造复现并使用同条件验证；NC-168 将复查修前失败与当前通过，不能仅引用已有部署。
- 治理收益：消除“定向测试 + 同合同边界测试”的机械重复，补设计冻结前的针对性审查。新增成本仅命中现有 design/validation 的数行规则；可原地撤回，不涉及命令/script/baseline。
- 初始规则体积：AGENTS 11951，lifecycle 7500，design 6028，validation 5397，review 4020 字节。
- NC-168 在 Linear Backlog，但主干代码和日志显示已修复且此前部署；不能仅凭 tracker 重复实现。
- NC-170 已确认上述 OR 是可复现遮蔽边界，删除后 UI 消费单 owner；真实终态前仍执行的耗时不被伪装为已结束。设计/文档/changeset 同步，subjective review 无 findings，无新增 CLI 操作。
- NC-168 无新生产改动，复用已确认设计，真实旧代码故障注入与当前两次恢复证据已闭合；临时浏览器 harness 已删除。物理手机/运营商未抽样，SSE 静默流已有 70 秒 idle timeout，未伪称立即恢复。
- 尚未关闭：LOCAL（最后一项提交合入及整体核对）；压缩恢复先读本文件和 git status，不重读全部技能。
