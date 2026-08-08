# v0.26.68 微信群二维码更新

## 迭代完成说明

- 使用 2026-08-08 用户提供的最新微信群二维码替换现有对外联系素材。
- 通过仓库统一入口 `pnpm run assets:update-wechat-qr` 同步 GitHub README 稳定资源、官网稳定镜像和官网日期化缓存资源，未引入第二套更新逻辑。
- GitHub 中英文 README 继续引用 `images/contact/nextclaw-contact-wechat-group.png`；官网改为引用 `/contact/nextclaw-contact-wechat-group-2026-08-08.png`。
- 旧日期资源保留为未引用的历史素材，避免破坏已发布页面或外部缓存中的旧链接。

## 测试/验证/验收方式

- 资源同步命令执行成功；三个目标 PNG 均为 `1207 × 1732`，SHA-256 均为 `0cd999d4ab68eb341c4d5c447917d7609f42d6299dc817e1b920e3e433d32a05`。
- 人工查看同步后的 GitHub 稳定资源，确认二维码、群名称和有效期说明完整，没有裁切或损坏。
- 检查 `README.md`、`README.zh-CN.md` 与官网内容配置，确认 GitHub 使用稳定路径、官网使用 2026-08-08 日期化路径。
- `pnpm --filter @nextclaw/landing tsc` 通过。
- `pnpm --filter @nextclaw/landing lint` 通过（0 个错误；`apps/landing/src/main.ts` 保留 2 个与本次无关的既有文件长度警告）。
- `pnpm --filter @nextclaw/landing build` 通过；仅有既有 Browserslist 数据过期提示。
- 通过隔离的 Vite preview 对 `http://127.0.0.1:5196/zh/` 做真实页面冒烟：首页返回 200，二维码资源返回 200、类型为 `image/png`，浏览器确认图片加载完成、原始尺寸为 `1207 × 1732`、页面渲染尺寸为 `160 × 160`。

## 发布/部署方式

- 本轮本地仓库资源、引用和迭代记录随当前本地提交纳入版本历史；未推送、未部署线上官网。
- 后续完成相应提交、推送与官网发布后，GitHub README 和官网才会公开使用本次二维码。
- 不涉及数据库迁移、运行时更新或 NPM 包发布。

## 用户/产品视角的验收步骤

1. 打开 GitHub 中文或英文 README 的微信群区域，确认展示新的“NextClaw 股东许愿 OpenClaw 交流群”二维码。
2. 打开官网中文页面的社区区域，确认二维码能正常加载，且请求地址包含 `nextclaw-contact-wechat-group-2026-08-08.png`。
3. 在二维码标注的有效期内（2026-08-15 前）使用微信扫码，确认能够进入对应群聊流程。

## 可维护性总结汇总

- 复用仓库既有二维码同步脚本作为唯一资源 owner，一次生成 GitHub 稳定资源、官网稳定镜像和官网日期化资源，避免人工多点复制导致漂移。
- 生产源码仅替换一条资源路径，新增 1 行、删除 1 行、净增 0 行；未新增分支、抽象、组件或运行链路。
- 新增文件仅为日期化静态图片与本次迭代记录，属于缓存刷新和交付留痕，不增加生产逻辑维护面。

## NPM 包发布记录

- 不涉及 NPM 包发布；本次为官网与 GitHub 外部联系素材更新。
