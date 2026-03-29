# 迭代完成说明

本次是一次最小修正发布，用来修复上一轮整批发布中的版本碰撞问题。

根因是：

- 本地把 `@nextclaw/channel-plugin-weixin` 从 `0.1.11` 升到 `0.1.12`
- 但 npm 上已经存在旧的 `0.1.12`
- 结果 `changeset publish` 会跳过该包发布
- 而 `@nextclaw/openclaw-compat` / `@nextclaw/server` / `nextclaw` 又会依赖这个旧的 `0.1.12`

这会导致“主批次发布成功”，但用户真正安装到的微信插件依然不是本次新增 self-notify route hint 的版本。

因此本次只对真正受影响的依赖链做最小修正发布：

- `@nextclaw/channel-plugin-weixin`
- `@nextclaw/openclaw-compat`
- `@nextclaw/server`
- `nextclaw`

# 测试/验证/验收方式

本次修正发布建立在上一轮已通过的基础验证之上：

- 微信真实链路冒烟已通过：AI 可在新 UI/NCP 会话里调用 `message` 向微信 route 发送真实消息
- 上一轮发布中的 `build` / `lint` / `tsc` 已全部通过

本次额外验证重点：

- 核实 npm 上已有的 `@nextclaw/channel-plugin-weixin@0.1.12` 缺少新的 self-notify route hint
- 重新 bump 版本，确保新代码以新的可发布版本号真正进入 npm
- 发布后核对：
  - `@nextclaw/channel-plugin-weixin`
  - `@nextclaw/openclaw-compat`
  - `@nextclaw/server`
  - `nextclaw`

# 发布/部署方式

本次按最小修正发布执行：

1. 为受影响链路创建新的 changeset。
2. 执行 `pnpm release:version`，生成新的 patch 版本。
3. 提交 version bump。
4. 执行 `pnpm release:publish`，只发布新的修正版本。
5. 推送新增 commits 与 tags。

# 用户/产品视角的验收步骤

1. 安装本次修正后的 `nextclaw` 新版本。
2. 确保微信渠道已登录，且保存了默认账号与授权用户 route。
3. 新开一个普通 AI 会话，直接说“做完后通过微信通知我”。
4. 观察 AI 是否能够直接拿到已保存的微信 self-notify route，并主动调用 `message` 发消息。
5. 若安装依赖链中包含 `@nextclaw/openclaw-compat` 或 `@nextclaw/channel-plugin-weixin`，也应对应升级到本次修正后的版本。
