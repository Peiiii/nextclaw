# 轻量常驻与 VPS 宣传体系交付

## 迭代完成说明

本次把扩展运行时按需激活的内存收益接入 NextClaw 对外内容链路：官网首页与安装页说明 VPS、NAS 和 Linux 长期运行场景，README 和安装文档提供简短量化结果，中英文资源占用页统一承载三轮 working set、peak、PSS、测量方法和架构边界。

产品上位定位继续是“长期个人智能搭档”。轻量常驻作为低成本长期在线的证据，不改写首屏主定位，也不使用未经同机同口径验证的竞品比较。ARM64 Linux 空配置三轮平均 working set 约 164.94 MiB、相对旧启动方式下降约 81%；真实 AMD64 VPS 和 1 GiB VPS 尚未形成绝对内存与最低配置承诺。

设计合同见 `docs/designs/2026-08-09-lightweight-vps-messaging.design.md`。

## 测试/验证/验收方式

- `pnpm -C apps/landing tsc` 通过。
- Landing 生产构建通过；中英文首页构建产物均包含新的 VPS 长期运行主张。
- VitePress 中英文生产构建通过；`/en/guide/resource-usage` 和 `/zh/guide/resource-usage` 均生成成功，内部链接可解析。
- 定向 ESLint 为 0 error；`apps/landing/src/main.ts` 仅保留既有文件与方法体积 warning，本次等量替换文案，没有增加行数。
- 新文件治理、`git diff --check`、量化数字一致性和夸大主张红线扫描通过。
- 文档构建产生的 Project Pulse 时间戳与仓库统计漂移已恢复，没有混入交付。
- 官网生产构建和 Cloudflare Pages deployment `d896b61e` 通过；`nextclaw.io` 的中英文首页脚本和中文安装页 SEO 均命中新文案。
- 文档工作流 [31322927614](https://github.com/Peiiii/nextclaw/actions/runs/31322927614) 通过 build、全球 Cloudflare、国内 OSS/CDN 和最终 verify。`docs.nextclaw.io` 与 `docs.nextclaw.net` 同时报告内容提交 `a905cc9dd6e58c8180739d874d36f36e53958088`、tree hash `e38629b2a5df1bf4c9d07585c08f75daa42c1ae78a6bd11921b7334a78c47017`；两域中英文资源页均返回目标量化内容。

## 发布/部署方式

- 官网：已通过根命令 `pnpm deploy:landing` 构建并部署到 Cloudflare Pages 的 `nextclaw-landing` production branch，deployment URL 为 `https://d896b61e.nextclaw-landing.pages.dev`。
- 文档站：内容提交进入 `origin/master` 后，已由 `docs-deploy.yml` 使用同一 artifact 部署到全球 Cloudflare Pages 和国内 OSS/CDN，并由 release manifest 校验两域身份一致。
- 生产验证目标：`https://nextclaw.io`、`https://docs.nextclaw.io`、`https://docs.nextclaw.net`。
- 本次不部署 NextClaw runtime，不发布 NPM 包或桌面安装包。

## 用户/产品视角的验收步骤

1. 打开中英文官网首页，确认差异化价值卡片明确提到 VPS、NAS、Linux 长期运行和未启用渠道不常驻。
2. 打开中英文安装页，确认 Docker/VPS 路径同时保留无需 API Key 和轻量常驻说明。
3. 从官网、README、安装页或文档侧栏进入资源占用页，确认中英文路由均可访问。
4. 核对资源页三轮数据、测试环境、活跃任务边界和 AMD64/1 GiB 未验证边界。
5. 确认页面没有把 ARM64 的 164.94 MiB 承诺为所有 VPS 固定结果，也没有声称比 OpenCode 或 OpenClaw 更省内存。

## 可维护性总结汇总

完整量化数据只由中英文 `resource-usage.md` 承载，官网、README 和安装文档使用摘要并链接证据页，没有为同一事实新增多套基准 owner。新增文件命名与目录治理通过。

自动 maintainability guard 为 0 error、1 个既有文件预算 warning；主观复核确认 `apps/landing/src/main.ts` 只做等量文案替换，没有增加职责、抽象或结构债务，因此没有为消除历史告警扩大本次内容范围。

## NPM 包发布记录

本次不执行 NPM 包发布。现有 `.changeset/on-demand-extension-runtime.md` 已补充约 81% 的受限环境内存收益，后续随包含按需扩展运行时的稳定 NPM 批次统一进入用户更新说明；当前生产部署仅覆盖官网和文档站内容。
