# Goal Progress

## 当前目标
把 `packages/nextclaw-core` 按已确定方案完整迁移到 `app-l2` 结构，并验证通过。

## 明确非目标
不新增开放协议；不改 release 批量版本内容；不重写业务行为；不把阶段完成当总完成。

## 冻结边界 / 不变量
保持 `@nextclaw/core` 公共 API 可用；目录协议只使用既有白名单；core 结构问题必须真实收敛。

## 已完成进展
- 已提交 `goal-mode` 规则补强：`cf3cbfda`。
- 已确认 core 当前主要问题是 `app-l1` 与多稳定域真实形态不匹配。

## 当前下一步
创建 app-l2 目标目录，移动 core 源码并修复导入导出。

## 锚点计数器
1/20
