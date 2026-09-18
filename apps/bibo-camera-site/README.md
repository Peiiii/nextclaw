# Bibo 官网

当前认可的「搭档相机」版本是 `https://bibo.bot/` 默认页面。页面展示四帧交互故事，支持点击画面、快门按钮、上一帧与方向键；角色参与换帧动作。它是产品概念演示，尚未提供账号、真实 AI 或云端任务服务。

## 保留的独立候选

| 公开路径 | 独立源码 | 方向 |
| --- | --- | --- |
| `/` | `apps/bibo-camera-site/dist` | G 搭档相机 |
| `/concepts/a/` | `apps/bibo-site/dist` | A 抽象品牌 |
| `/concepts/b/` | `apps/bibo-sprite-site/dist` | B 行动精灵 |
| `/concepts/c/` | `apps/bibo-navigator-site/dist` | C 领航员 |
| `/concepts/d/` | `apps/bibo-workshop-site/dist` | D 工作台 |
| `/concepts/e/` | `apps/bibo-edge-site/dist` | E 边缘精灵 |
| `/concepts/f/` | `apps/bibo-orbit-site/dist` | F 轨道精灵 |

各版保持独立 HTML、CSS、JS 和资源；不添加网站内版本切换器。候选路径设置 `noindex`，避免与默认版本争夺搜索结果。这里的 `dist` 是手工维护的静态源文件，不要按编译缓存删除。

## 构建与发布

本地候选优化：手机标题区更紧凑，画面底部显示“轻点继续 / 轻点重看”，上一帧触控区扩大；360×740 可在首屏看见完整快门。此次候选尚未发布到正式站；[Loop 设计](../../docs/loops/2026-09-18-bibo-optimization.loop.md)与[执行日志](../../docs/logs/v0.56.2-bibo-loop-pilot/README.md)分别维护。

后续[三轮候选](../../docs/logs/v0.56.3-bibo-loop-three-rounds/README.md)：键盘 Enter 换帧后保留焦点，可继续方向键；手机画面左滑前进、右滑回看，末帧左滑重看，纵向滚动和缩放保留；末帧预设示例提供具体变化与首发建议。所有内容仍为概念演示，候选尚未部署。

最新[整体设计三轮实验](../../docs/logs/v0.56.4-bibo-design-leap/README.md)改为互动海报构图、整页四幕日常和纸条交接。桌面可将首帧纸条拖到 Bibo 面前，松手接单；拖错或 Escape 会取消。点击角色、画面或快门也可推进，手机仍支持轻点和滑动。预设故事始终标注示例，没有真实执行任务。本地当前候选尚未部署，历史独立版本保留。

在仓库根目录执行：

```sh
node apps/bibo-camera-site/site-build.controller.mjs
pnpm exec wrangler deploy --config apps/bibo-camera-site/wrangler.toml
```

生成目录 `.publish` 不提交。正式站使用 Cloudflare Worker `bibo-bot` 的静态资源，通过精确 zone route `bibo.bot/*` 接管全部路径。现有根 CNAME 保持 proxied；请求由 Worker 直接响应，不回源到历史 Pages 项目。当前 OAuth 没有 DNS 写权限，因此不使用要求替换 CNAME 的 Custom Domain。Pages 项目 `bibo-bot` 保留作为已验收的预览，生产发布以本文件中的 Worker 命令为准。其他域名和旧项目保持原状。

回滚：普通更新使用 Workers 的上一版本回滚；首次迁移如需撤销，先将 `bibo.bot` 重新绑定 Pages 的 `nextclaw-landing` 并等待 active，再移除 `bibo.bot/*` Worker route。根 CNAME 仍为 `nextclaw-landing.pages.dev`，无需改动。

发布验收：根路径与六个候选均返回对应 HTML；样式、控制器及图片可加载；无尾斜杠路径正确重定向；未知路径返回 404；默认版完成前进、后退、重播、键盘与弹窗操作。手机无横向溢出。

本项目独立于 NextClaw 的 NPM 包和文档站，不添加 NextClaw changeset、不触发 NPM 发布。产品可见说明由官网演示提示与本文件承担。设计历史见 `docs/designs/2026-09-18-bibo-public-surface.design.md`。
