# 近期 Linear 问题统一交付

- contract-id：linear-batch-20260909；parent-goal：完成 NC-171～173 并复核 NC-163～165，提供统一可运行验收环境。
- scope-revision：1；scope-confirmation：user-confirmed，用户于本会话确认启动整批收尾。
- 分支：codex/linear-batch-171-173；工作区：/Users/peiwang/Projects/nextbot-linear-batch-171-173。
- 当前交付门：NC-173 用户实测发现授权失焦中断，整批退回返工；真实授权链路复验通过前不得交付。NC-160/161 保持取消。
- 上位设计：[整批设计](../designs/2026-09-09-linear-batch-closure.design.md)。

## Active acceptance ledger

| ID | Required | 合同 | Status | 当前证据 |
| --- | --- | --- | --- | --- |
| LB-01 | true | NC-171 可复现 AVIF/WebP 多尺寸交付、单一 Hero 优先、其余 lazy、尺寸稳定、指纹缓存 | passed | 27 张图片生成/预算检查、build 与 browser 检查；线上响应头在发布门验 |
| LB-02 | true | NC-171 中英文桌面/移动真实浏览器清晰度、请求字节、LCP/CLS 对比及可打开原图 | passed | 12 个浏览器组合；生产对照初始图片减少89%～96%；截图与指标已留存 |
| LB-03 | true | NC-172 四种定界符在聊天和文档预览工作；代码、转义及 streaming 不退化 | passed | 14 测试；真实模型 SSE 279事件与4→7→8 DOM过程；实际文件预览4公式 |
| LB-04 | true | NC-173 首次提示、权限/设备/不支持反馈、明确环境恢复引导和重试；取消及重进正确 | rework | 授权时序已修复；内置页22:00实测check成功→onstart→0.85秒后原生network；Chrome对照保持聆听。不是未授权，浏览器服务连接未通；新增独立转写需确认模型/数据流，不关闭 |
| LB-05 | true | NC-163～165 原始合同复核，有缺口登记并处理 | passed | 历史真实闭环与当前owner核对；core16/app-runtime5/Marketplace24回归通过 |
| LB-06 | true | 匹配 tsc/测试、diff-only Review、用户文档和统一真实验收入口 | rework | 返工后49项语音/输入框测试、UI tsc、定向lint、diff-only 0 findings通过；文档已同步；等LB-04闭合。5194 UI + 5198官网仍运行 |

## 执行和恢复

1. 理解/设计：逐项核对 source → owner → consumer，冻结具体实现；设计 Review 后实施。
2. NC-172：共用 Markdown parser，先回归复现，再实现与验证。
3. NC-173：复用 voice manager 和 panel，完整错误恢复；不持久化浏览器权限副本。
4. NC-171：建立原版对照，生成资源并统一图片渲染，桌面/移动对比。
5. NC-163～165：复用仍有效历史证据，核对实际代码与合同差异。
6. 最终验证、Review、文档和真实环境交付；只有 LB-01～06 current passed 才报告整批可验收。

恢复从本文、git diff 和最近证据继续；每个切片结束更新对应 ID。不能从版本号推断 issue 完成。

## 当前交付状态

最新用户反馈与补充：独立浏览器页面用户报告正常；同一内置环境的原版manager/hook亦复现network，已撤除诊断并恢复修复版本，不扩大转写服务。新增用户要求“Esc保存退出、悬浮提示、无撤销叉号”已实现；53项定向测试、UI tsc、定向lint（仅既有长度警告）、diff-only Review通过，真实Chrome输入框Esc→收尾→浮层关闭通过。原版对照不等于内置转写成功，整批/发布仍待用户统一确认。

flow=standard（包含两个 bugfix 切片）；AI validation/review reopened；Delivery=未达到验收标准；parent-status=NC-173 返工中。用户实测推翻 LB-04 和整批通过结论，其它有效证据保留。

详见[统一验收证据和步骤](../logs/v0.49.3-linear-batch-acceptance/README.md)。本机入口：`http://127.0.0.1:5194/chat/sid_bmMxNzItbGluZWFyLWJhdGNoLTIwMjYwOTA5` 与 `http://127.0.0.1:5198/zh/`。用户确认后才进入合并、发布和部署后的检查；此时重新检查主线与其它任务 WIP，不混入并发规则改动。
