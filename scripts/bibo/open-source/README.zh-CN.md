# Bibo

**开源个人 AI 工作空间，带真正能跑代码的 Linux 沙箱。**

[English](README.md) · [在线体验](https://app.bibo.bot) · [官网](https://bibo.bot) · [版本发布](https://github.com/Peiiii/bibo/releases)

让 Bibo 处理一份表，留下报告，再把后续行动存成待办。对话、笔记、任务、日程和文件都在同一个空间里。

![在对话旁打开保存的咖啡店销售报告，报告清楚标明示例数据](images/screenshots/bibo-chat-report.png)

- **能执行：** 按需启动隔离的 Linux 沙箱，运行 Python、Shell 和命令行工具。
- **能留下成果：** 文件保存在 R2，同一份文件可供沙箱处理、网页打开和编辑。
- **日常开销轻：** 普通对话、任务和文件操作在 Cloudflare 边缘完成，无需常驻 Linux 容器。

## 看看实际使用

以下都是线上真实截图。销售和订单数字为示例数据，代码执行、文件保存和待办创建来自真实运行。

### 用 Python 整理订单

读取 CSV，删除两行完全重复的记录，新增金额列。结果是 5 笔订单、9 件商品、总额 214；说明记录了沙箱实际运行的 Linux 与 Python 版本。

![真实订单清洗对话与打开的说明，包含计算结果和 Linux、Python 环境信息](images/screenshots/bibo-sandbox-execution.png)

### 文件可以重新打开、继续编辑

原表、清理后的 CSV 和 Markdown 说明保存在个人文件空间，可以搜索、打开和编辑。

![搜索订单整理文件夹并打开实际保存的清理后 CSV](images/screenshots/bibo-file-workspace.png)

### 把后续行动留下来

销售分析后的备货、检查低谷原因和下周复盘，保存为可编辑的任务。

![三个已保存的后续待办，以及周末备货任务的编辑详情](images/screenshots/bibo-tasks.png)

### 手机也能接着用

<p>
  <img src="images/screenshots/bibo-mobile-chat.png" alt="手机上的 Bibo 对话与报告摘要" width="280" />
  <img src="images/screenshots/bibo-mobile-tasks.png" alt="手机上的已保存任务列表" width="280" />
</p>

<details>
<summary>查看保存后的完整销售报告</summary>

![文件编辑器中的销售报告，包含示例数据说明和计算结果](images/screenshots/bibo-sandbox-analysis.png)

</details>

## 本地看看

需要 Node.js 22.23.2 或更新版本、pnpm 9.15.1。

```sh
git clone https://github.com/Peiiii/bibo.git
cd bibo
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

打开 `http://127.0.0.1:5188`。这是无需凭据的界面预览，对话为模拟数据；真实模型和 Linux 沙箱需要以下 Cloudflare 部署。当前界面为中文，模型可使用用户的语言回复。

## 部署自己的私有空间

准备自己的 Cloudflare 账号（Workers Paid、Containers/Sandbox 和 R2）及 DeepSeek API Key。开源版是单人私有空间，不开放公共注册，也不依赖官方托管版账号。

1. 编辑 `apps/bibo-hosted/wrangler.toml`，设置自己的 Worker 名称、R2 bucket 名称和 `BIBO_OWNER_EMAIL` 登录邮箱。
2. 登录 Cloudflare 并创建对应 bucket：

   ```sh
   pnpm -C apps/bibo-hosted exec wrangler login
   pnpm -C apps/bibo-hosted exec wrangler r2 bucket create bibo-personal-data
   ```

3. 交互式设置密码与密钥。使用至少 16 位的独立随机密码，建议 32 位以上。密码与密钥只放 Worker Secret，不写入配置或任何 `VITE_` 变量。

   ```sh
   pnpm -C apps/bibo-hosted exec wrangler secret put BIBO_OWNER_PASSWORD
   pnpm -C apps/bibo-hosted exec wrangler secret put BIBO_DEEPSEEK_API_KEY
   # 可选：联网搜索
   pnpm -C apps/bibo-hosted exec wrangler secret put BIBO_EXA_API_KEY
   ```

4. 执行 `pnpm deploy`，打开 Wrangler 返回的 HTTPS 地址，用所设置的邮箱和密码登录。升级时拉取对应版本、冻结安装依赖后重新部署；保留 Worker、bucket 和 DO migration 身份以继续使用已保存数据。更换密码会使已有登录失效。

本地 Worker 开发可以把 Secret 放入已忽略的 `apps/bibo-hosted/.dev.vars`：先 `pnpm build`，再分别启动 `pnpm dev:worker`、`pnpm dev:proxy`。本地沙箱还需要 Docker。`pnpm dev` 始终是模拟界面。

## 验证真实沙箱

先让 Bibo 创建任务或保存笔记，然后打开、编辑并刷新读回。再发送：

> 用 Linux 沙箱里的 Python 计算前 20 个斐波那契数。挂载我的工作空间，把结果保存为 fibonacci.txt，然后打开文件。

Agent 通过 `exec` 执行、`mount_directory` 挂载持久文件；网页读取同一份 R2 文件。生成时可离开或刷新页面，回来继续查看同一次服务端任务。单次任务最长 10 分钟，服务中断会明确报错，不自动重放已有副作用的操作。

## 架构与成本

另一个执行例子见[Linux 沙箱执行记录](images/screenshots/bibo-sandbox-workspace.png)。

React → Worker → 单人 Durable Object → 公共 NextClaw Harness → 模型与工具。会话和结构化状态保存在 DO，文件保存在 R2，OS 工具才获取沙箱。网页与 Agent 复用同一个领域动作 owner。架构图及更多细节见 [English README](README.md#architecture)。`SOURCE.json` 标记上游源码版本；公共内核通过锁定版本的 NPM 包复用。

没有常驻 Linux 容器的日常负担，沙箱默认空闲 5 分钟后休眠。费用仍包括 Cloudflare 套餐、Workers/DO/R2 用量、沙箱运行资源，以及模型和可选搜索 API。见 [Workers 计费](https://developers.cloudflare.com/workers/platform/pricing/)和 [Containers 计费](https://developers.cloudflare.com/containers/pricing/)。不承诺所有用户固定月费或完全免费。

首版使用 `deepseek-flash`，单次模型调用最多 2,048 输出 token，一个任务可能调用多次；保留每位用户每日 250 次模型调用、整个部署每日 2,000 次及每小时 100 次聊天限制。搜索有独立额度。沙箱系统、安装的软件、Git 和 `/workspace` 是临时的，只有显式挂载的 R2 文件持久化。

## 参与与许可证

执行 `pnpm typecheck`、`pnpm test`、`pnpm build` 和 `pnpm -C apps/bibo-hosted exec wrangler deploy --dry-run` 检查改动。欢迎在 [Issues](https://github.com/Peiiii/bibo/issues) 提供部署反馈和实际使用案例；贡献与安全问题见 [贡献说明](CONTRIBUTING.md)和 [安全说明](SECURITY.md)。早期版本请自行备份重要文件。

[MIT](LICENSE)，保留 NextClaw 的版权与许可证。
