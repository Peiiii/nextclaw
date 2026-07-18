# v0.25.21 官网 Agent 与消息渠道截图更新

## 迭代完成说明

- 使用本地真实实例和真实数据重新生成中英文 Agent 管理截图，完整展示多个独立 Agent 及其头像。
- 使用最新版消息渠道界面重新生成中英文截图，展示微信、飞书/Lark、QQ 等真实接入状态与微信连接流程。
- Agent 截图增加头像就绪检查：每张可见卡片必须已有图片头像或回退头像，避免把资源尚未加载完成的界面写入正式素材。
- 官网改为通过 Vite 导入 Agent 与消息渠道截图，构建产物使用内容哈希文件名，避免部署后继续命中旧图缓存。
- 截图脚本只维护 `images/screenshots/` 单一来源，不再同步生成重复的 landing public 镜像。

## 测试/验证/验收方式

- `pnpm exec eslint scripts/docs/product-screenshot-browser-helpers.mjs scripts/docs/refresh-product-screenshots.mjs`：通过。
- `pnpm -C apps/landing tsc`：通过。
- `pnpm -C apps/landing lint`：0 error；保留 `main.ts` 文件长度和 `render` 方法长度两个既有 warning。
- `pnpm -C apps/landing build`：通过；Agent 与消息渠道图片均生成新的内容哈希资源。
- 本地浏览器验收：`http://127.0.0.1:5175/zh/` 正确加载新版中文图片，图片自然尺寸为 `3024 × 1656`，页面无控制台错误。
- 真实 Agent 页面验收：可见 Agent 卡片的图片头像均已完成加载并具有有效自然尺寸，回退头像具有完整布局尺寸。
- maintainability guard：0 error、2 warning；生产与脚本改动为 `+35 / -20`，净增 15 行，warning 为既有文件预算。
- `pnpm check:governance-backlog-ratchet`：通过。
- `pnpm lint:new-code:governance`：本批未重复运行；当前工作区存在本迭代范围外的 platform console 与 provider gateway 并行改动，定向 ESLint、类型检查、构建和治理 ratchet 已覆盖本批文件。

## 发布/部署方式

- 使用 `pnpm deploy:landing` 构建并部署到 Cloudflare Pages 项目 `nextclaw-landing` 的 `master` 分支。
- 正式站入口：`https://nextclaw.io/zh/`。
- 不涉及后端、数据库、migration、runtime update、桌面端或文档站发布。

## 用户/产品视角的验收步骤

1. 打开官网中文首页，找到“为不同工作保留独立的 Agent”板块。
2. 确认截图中的 Agent 卡片均有完整头像，不存在资源未加载的空白图标。
3. 找到“微信、飞书等入口可以接进来”板块，确认截图采用最新版设置界面，并展示真实渠道数据。
4. 刷新页面，确认仍加载带内容哈希的新图，而不是浏览器缓存中的旧截图。

## 可维护性总结汇总

- 使用了 `post-edit-maintainability-review` 的复核口径。
- 截图等待逻辑集中在现有 browser helper owner，场景定义只声明调用，没有新增平行截图流程。
- Agent 与消息渠道图片统一由 `images/screenshots/` 管理，删除脚本中的重复 public 输出，资产 owner 更清晰。
- `main.ts` 仅替换图片引用，文件行数净增 0；没有在超预算入口文件中增加页面结构或业务逻辑。
- 新增的 15 行净增长用于阻止半加载截图进入正式资产，属于可重复验证的自动化质量门。

## 红区触达与减债记录

### apps/landing/src/main.ts

- 本次是否减债：是。
- 说明：将固定 public URL 收敛为 Vite 内容哈希导入，消除重复资产和旧图缓存风险；文件行数净增 0。
- 下一步拆分缝：后续继续把静态内容按既有 landing content owner 拆分，不在本次截图修正中扩大范围。

### scripts/docs/refresh-product-screenshots.mjs

- 本次是否减债：是。
- 说明：删除 Agent 与消息渠道场景的 public 镜像输出，并复用统一的浏览器等待 helper；文件净减少 5 行。
- 下一步拆分缝：新增场景继续进入既有场景工厂，不为单张图片创建独立脚本。

## NPM 包发布记录

不涉及 NPM 包发布；`@nextclaw/landing` 为私有部署单元，本次只发布官网。
