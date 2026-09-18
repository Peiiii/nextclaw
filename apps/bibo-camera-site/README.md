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

在仓库根目录执行：

```sh
node apps/bibo-camera-site/site-build.controller.mjs
pnpm exec wrangler pages deploy apps/bibo-camera-site/.publish --project-name bibo-bot --branch master
```

生成目录 `.publish` 不提交。Cloudflare Pages 项目 `bibo-bot`，生产分支 `master`，只承载 Bibo。首发前先验证 Pages 临时域名，再将 `bibo.bot` 从 `nextclaw-landing` 迁到新项目，并将根 CNAME 改为 `bibo-bot.pages.dev`。其他域名和旧项目保持原状。

回滚：普通更新在 Pages 回滚到上一部署；首次域名迁移如需撤销，将 `bibo.bot` 自定义域名重新绑定 `nextclaw-landing`，并恢复 CNAME `nextclaw-landing.pages.dev`。

发布验收：根路径与六个候选均返回对应 HTML；样式、控制器及图片可加载；无尾斜杠路径正确重定向；未知路径返回 404；默认版完成前进、后退、重播、键盘与弹窗操作。手机无横向溢出。

本项目独立于 NextClaw 的 NPM 包和文档站，不添加 NextClaw changeset、不触发 NPM 发布。产品可见说明由官网演示提示与本文件承担。设计历史见 `docs/designs/2026-09-18-bibo-public-surface.design.md`。
