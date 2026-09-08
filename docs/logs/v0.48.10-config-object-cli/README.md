# 供应商、模型与搜索 CLI

## 迭代完成说明

新增 providers、models、search 对象级命令，覆盖供应商 CRUD/启停/凭据、模型列表和能力覆盖、发现与连接测试、授权启动/轮询/导入、默认模型与搜索配置。CLI 复用运行实例发现、bridge 认证、server 配置 owner 与应用回调，不新增直接文件写入路径。旧 gateway/config 入口保留为未覆盖能力或显式恢复的过渡路径。

设计及 active acceptance ledger：[配置对象级 CLI](../../designs/2026-09-08-config-object-cli.design.md)。

## 测试/验证/验收方式

- CLI 定向测试覆盖参数映射、无修改、非法枚举、凭据冲突、模板拼写、覆盖行为、脱敏和失败退出码。
- 命令注册树与文档站中英文全集逐项对账。
- 独立临时 home/run-home、真实 HTTP 服务与真实 CLI 子进程验证认证、保存、配置应用回调及默认模型路由消费，确认无关渠道设置不变。
- 集成验证中的供应商模型发现与连接调用使用受控替身；不声称真实第三方联网或 OAuth 授权实测。
- nextclaw/core/kernel/server tsc、29 项测试、定向 lint、治理和 skill 检查均通过；维护性 0 error，保留两条已评估的历史边界警告。CLI 产物构建后检查了三个命令组帮助及无服务时非零退出且不写配置文件。

## 发布/部署方式

用户授权提交、合入 master 并推送；使用隔离工作区交付，保留主工作区其他任务改动。此交付不包含 NPM、桌面版发布或线上部署。

## 用户/产品视角的验收步骤

1. 在运行 NextClaw 的环境查询 `providers templates` 与 `providers list`。
2. 用环境变量提供密钥并添加供应商，发现模型，设置模型列表并测试连接。
3. 设置默认模型，用 `models show` 与 `providers show` 确认。
4. 修改搜索供应商并用 `search show` 确认。
5. 授权型供应商按 `auth start` 返回的 URI/code 完成操作，再按返回间隔 `auth poll`，确认 authorized。

## 可维护性总结汇总

复用既有业务和认证链路；新增代码限 CLI 参数翻译与显示，不复制保存/热更新实现。命令注册归 commands、控制器归 controllers/config，避免扩大入口根目录。维护性初检发现目录预算问题，已按责任归位；主观复核检查了业务 owner、覆盖操作、失败语义和测试边界。既有入口文件接近预算、context provider 目录已有例外，未扩大这些历史边界。

## NPM 包发布记录

本次不执行 NPM 包发布。`nextclaw` 新增用户可用命令，`@nextclaw/core` 和 `@nextclaw/kernel` 更新 AI 自管理指引，已添加 changeset，待统一发布。`@nextclaw/server` 仅新增测试，无独立用户行为 changeset。
