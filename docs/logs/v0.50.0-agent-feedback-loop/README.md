# 0.50.0 用户反馈与 AI 维护闭环

## 迭代结果

完整系统已发布并完成 AI 验收，待用户验收：匿名 AI/CLI 反馈、原管理平台审批、私有维护应用提醒 Codex、Codex 经 CLI 修复与回写、两修复同批发行和真实安装查询。完整范围与 18 项必需合同见 [验收账本](../../plans/2026-09-09-agent-feedback-loop.plan.md)。

两条生产原单 1a946c86-acf5-4f3a-8b61-75db7d3dd908、f60f303c-61e9-4468-94b8-4530dd14326b 均为 published / revision 7 / 0.50.0 / 4 条回复。第一条 publish 同参数重试后未增加评论。代码扫描空闲不调用模型。

## 根因与可维护性

- 用户反馈 CLI 的 --version 被全局版本路径截获，改为 --affected-version 并同步指南；正式安装后真实提交验证通过。
- Workers 不支持 redirect:error，改为 manual 并拒绝重定向；生产管理平台恢复。
- 长期应用原先散落 scripts，现归 private package；客户端复用 nextclaw 公共入口，kernel 无反馈概念。
- 外层不再替 Codex 写修复或发行模板评论；平台是状态 owner，Codex 通过 CLI 写自己的判断。
- AI 验收原先漏对原始需求，现由 Validation 逐项对账并返工，Delivery消费结论；设计阶段同时约束现状、验收标准和交付方式。

## 验证与验收入口

私有包15项、门户14项、CLI全集2项及相关类型/构建/lint检查通过，源码Review无阻断项。生产管理员审批、实际 Codex 修复、平台发行核验、用户匿名回执恢复与幂等回评均已真实执行。

[正式 AI 会话](http://127.0.0.1:55668/chat/sid_ZmVlZGJhY2stZm9ybWFsLWFjY2VwdGFuY2UtMjAyNjA5MTA) 使用 Registry 安装的0.50.0及官方runtime，native/DeepSeek 经实际工具调用查询原单；模型短编号误写已在真实对话中更正。[原管理平台](https://platform-admin.nextclaw.io/?feedback=closed&q=&page=1&pageSize=10#/support)展示同一发行的两条完整历史。用户无需重新提交或运行测试，只确认体验与结果。

## 发布和部署

- [release 34387275723](https://github.com/Peiiii/nextclaw/actions/runs/34387275723)，attempt2成功；源码f9f0e0485942d58adb32c29fcee7af0c35a18dfa；发行提交7e2dde431872ff289d7471da4c89eb467b80bbfe。
- [prepare 34386552247](https://github.com/Peiiii/nextclaw/actions/runs/34386552247)，NPM和四平台Runtime成功。
- [0.50.0](https://github.com/Peiiii/nextclaw/releases/tag/nextclaw%400.50.0)，NPM_READY、四平台Runtime及上一stable升级均通过；Desktop二进制排除。
- D1迁移0003；反馈服务212a2775-dc9f-495c-83cc-18ef33b2910f；网关ddbeee52-31b0-4e00-b64a-67d8bc00eb2d；管理端Pages d53f65fa。Cloudflare本次由已认证Wrangler人工部署。
- [文档部署34385479106](https://github.com/Peiiii/nextclaw/actions/runs/34385479106)全球、国内及verify全部成功。
- 本机独立NPM cache安装0.50.0成功；带版本提交并读回的验收记录已撤回。私有维护应用不发布NPM。

## 耗时与失败恢复

正式任务UTC18:09:18–18:31:07，总计21分49秒；一次Windows/Node26安装超过5分钟后，仅重跑失败及依赖步骤，已有30包未重新上传。正式任务外的Linux prepare两次遇到Google Chrome源Hash Sum mismatch，限定Ubuntu静态工具链所需源后，真实构建通过。

NPM阶段197.21秒，60秒目标未达成：artifact6.40秒、package183.08秒、Git/install7.74秒；package内部precheck4.42秒、upload10.74秒、verify165.80秒（14次传播核验）。瓶颈是registry可见性而非上传，不通过删校验掩盖耗时。本机首次安装也遇到同一传播期ETARGET，整批可见后新cache重试成功。

AUTOMATION_INTERVENTIONS=1：正式发行入口之后执行了一次failed-only恢复；发行前工具链修正和独立验收安装恢复分别记录，不计作重复发布。

## 精确 NPM 发布清单

以下30包均由该次workflow首次上传并核验version/integrity/latest；依赖闭包中原有其它已提交改动由标准发行owner一并处理，未混入其它任务WIP。

- @nextclaw/server@0.23.3
- @nextclaw/remote@0.3.60
- @nextclaw/channel-extension-weixin@0.2.36
- @nextclaw/companion@0.2.60
- @nextclaw/client-sdk@0.12.3
- @nextclaw/agent-chat-ui@0.9.1
- @nextclaw/kernel@0.17.1
- @nextclaw/app-runtime@0.16.5
- @nextclaw/core@0.17.21
- @nextclaw/service@0.6.6
- @nextclaw/shared@0.6.0
- @nextclaw/extension-sdk@0.5.5
- @nextclaw/channel-extension-feishu@0.2.36
- @nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.48
- @nextclaw/channel-extension-discord@0.2.47
- @nextclaw/channel-extension-telegram@0.2.47
- @nextclaw/channel-extension-qq@0.2.34
- @nextclaw/mcp@0.3.48
- @nextclaw/runtime@0.4.47
- @nextclaw/nextclaw-narp-runtime-opencode@0.2.48
- @nextclaw/desktop-extension-wechat@0.2.5
- @nextclaw/channel-extension-wecom@0.2.47
- @nextclaw/channel-extension-email@0.2.47
- nextclaw@0.50.0
- @nextclaw/harness@0.2.17
- @nextclaw/channel-extension-slack@0.2.47
- @nextclaw/channel-extension-dingtalk@0.2.47
- @nextclaw/channel-extension-whatsapp@0.2.47
- @nextclaw/ncp-mcp@0.2.48
- @nextclaw/ui@0.25.2

## 运行边界

维护者进程和独立AI验收实例依赖本机在线。默认代码扫描，没有AI轮询任务；修复与发布独立授权；未声称OS级私密读取隔离或token数硬预算。普通生产账号关联未额外重演，身份合同使用真实本地平台及受控验证，不冒充全部生产场景实测。
