# Bibo 复用事务邮件传输

- 用户授权：Bibo账号独立，老用户迁移；「复用nextclaw不行吗」「我不知道什么resend密钥。你全权处理。如果需要登录resend我可以做最小协助」。不再索要密钥，服务端复用原发信能力。
- 方案：[跨产品邮件传输](../../designs/2026-10-22-transactional-email-rpc.design.md)。本批只添加私有Service Binding RPC并复用既有provider请求；Bibo账号/CLI仍由Peiiii/bibo主仓交付。
- 现场：Codex管理worktree /Users/peiwang/.codex/worktrees/bibo-auth-mail/nextbot，codex/bibo-auth-mail，基线802b1fe；源区七个WIP保持原样。首次编辑前治理preflight通过，证据/tmp/bibo-mail-preflight.log。
- 验证：定向Worker tsc/build、2项传输测试、触达文件eslint、Worker dry-run、new-code governance及backlog ratchet通过。证据为/tmp/bibo-mail-final-{build,tests,lint,dryrun}.log与/tmp/bibo-mail-{governance,ratchet}.log。
- Review：diff-only检查0 error；既有OTP模块412行接近预算的warning，搬至utils符合既有函数模块角色，较原438行减少。人工复核确认原OTP模板/状态链不变，provider请求归共享owner，私有命名entrypoint未加入公网路由，密钥不迁出。implementation-review: passed。
- 发布范围：仅provider gateway Worker，不发布NPM/runtime/desktop/NextClaw文档站，无DB迁移；Bibo账号与文档在自身仓交付。生产部署及Bibo集成证据待后续追加，不预报成功。
