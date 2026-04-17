# v0.16.55-browser-auth-page-i18n-alignment

## 迭代完成说明

- 把平台账号浏览器授权页从“纯英文、独立样式、无语言状态”的一次性页面，升级为支持 `zh-CN / en-US` 的国际化页面。
- 新增浏览器授权页语言 owner，优先级为：显式 `locale` 参数 > 授权页语言 cookie > `Accept-Language` > 默认英文。
- 登录、注册、重置密码、授权成功、会话失效、错误提示、验证码步骤提示都接入同一套中英文文案，并在表单提交后保持当前语言不丢失。
- 页面视觉重新收敛到 NextClaw 现有入口风格：双栏品牌说明 + 授权卡片、统一品牌色和层级、移动端响应式布局、显式语言切换入口。
- 将被触达的浏览器授权相关文件重命名为符合仓库治理要求的后缀命名：
  - `auth-browser-page-renderer.service.ts`
  - `auth-browser-page-copy.config.ts`
  - `auth-browser-page-styles.config.ts`
  - `auth-browser-page-support.utils.ts`
  - `auth-browser-route.controller.ts`
  - `auth-browser-session.service.ts`
  - `register-app-routes.service.ts`

## 测试/验证/验收方式

- 通过：`pnpm -C workers/nextclaw-provider-gateway-api build`
- 通过：`pnpm -C workers/nextclaw-provider-gateway-api tsc`
- 通过：`pnpm -C workers/nextclaw-provider-gateway-api exec eslint src/auth-browser-page-copy.config.ts src/auth-browser-page-renderer.service.ts src/auth-browser-page-styles.config.ts src/auth-browser-page-support.utils.ts src/auth-browser-route.controller.ts src/auth-browser-session.service.ts src/register-app-routes.service.ts src/index.ts --max-warnings=0`
- 通过：`node scripts/governance/lint-new-code-governance.mjs -- workers/nextclaw-provider-gateway-api/src`
- 通过：`pnpm dlx tsx -e "import { renderBrowserAuthPage, resolveBrowserAuthLocale } ..."`，确认：
  - 中文自动识别生效
  - 英文显式切换生效
  - 页面包含语言切换入口
  - 表单隐藏字段保留当前 `locale`
  - 中文注册按钮文案与英文授权按钮文案均已本地化
- 未通过但与本次改动无关：`pnpm lint:maintainability:guard`
  - 当前失败点来自其它工作区未完成改动：
    - `packages/nextclaw-core/src/agent` 目录预算跨阈值
    - `packages/nextclaw-core/src/config/schema.ts` 函数级 maintainability 继续恶化
  - 本次 worker 目标路径的定向治理已通过。
- 未通过但与本次改动无关：`pnpm -C workers/nextclaw-provider-gateway-api lint`
  - 失败原因是该包内已有 33 条历史 warning 被 `--max-warnings=0` 放大，不是本次新增 warning。

## 发布/部署方式

- 本次改动只影响 `workers/nextclaw-provider-gateway-api` 提供的浏览器授权页，不需要单独发布前端静态站点。
- 部署方式：
  - 本地验证完成后执行 `pnpm deploy:platform:backend`
  - 或只部署 worker：`pnpm -C workers/nextclaw-provider-gateway-api run deploy`
- 若线上已存在进行中的浏览器授权会话，不需要数据库迁移；新页面会在 worker 发布后直接生效。

## 用户/产品视角的验收步骤

1. 在桌面端或本地设备里发起一次平台账号浏览器授权，打开浏览器授权页。
2. 用中文浏览器访问时，确认页面默认展示中文文案，而不是英文。
3. 点击右上角语言切换为 `English`，确认标题、说明、登录/注册/忘记密码 tab、按钮和提示文案全部切换为英文。
4. 在英文状态下切到“注册”或“忘记密码”，发送验证码并继续下一步，确认提交后页面仍保持英文，不会跳回中文。
5. 刷新当前授权页，确认语言优先沿用刚刚选择的语言。
6. 用英文浏览器默认打开，再切回中文，确认两种语言都能完整覆盖登录、注册、密码重置、授权成功、会话过期与错误提示。
7. 对照 NextClaw 现有入口页，确认品牌色、层级、卡片感和移动端布局不再明显割裂。

## 可维护性总结汇总

### 长期目标对齐 / 可维护性推进

- 结论：`保留债务经说明接受`
- 本次顺手减债：`是`
- 这次改动顺着“统一入口、统一体验、开箱即用”的长期目标推进了一小步。浏览器授权页不再是一个游离在产品外的英文孤岛，而是回到了 NextClaw 统一入口的品牌和语言体系里。
- 同时也顺手偿还了两笔局部维护性债务：
  - 不再把所有文案、样式、语言解析和页面拼接硬塞在一个文件里
  - 不再继续沿用不符合当前仓库治理要求的历史命名

### 代码增减报告

- 新增：`1924 行`
- 删除：`947 行`
- 净增：`+977 行`
- 说明：
  - 当前工作区还未暂存，这里的“新增”包含新建分拆文件的完整行数，属于 rename + split 语义下的 diff 膨胀。
  - 真实功能增量主要来自中英文文案、语言解析、切换入口与重新设计的页面样式；并非新增了一条新的业务链路。

### 非测试代码增减报告

- 新增：`1924 行`
- 删除：`947 行`
- 净增：`+977 行`
- 说明：
  - 本次未新增测试文件，上述统计与总量一致。
  - 净增主要由显式的 i18n 文案和样式 token 驱动；虽然行数增加，但复杂度从“隐式散落字符串 + 单文件内联页面”收敛成了可预测的 `config / utils / service / controller` 角色边界。

### 可维护性复核

- 可维护性复核结论：`保留债务经说明接受`
- no maintainability findings
- 本次是否已尽最大努力优化可维护性：`是`
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：`是`
  - 在实现中已经先删除旧的单文件页面实现入口，并把职责拆回更明确的文件角色，而不是继续在原文件上叠补丁。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：`部分做到`
  - 总行数净增长，原因是 i18n 文案与页面样式被显式化，这是本次需求的最小必要成本。
  - 为对冲增长，已经把浏览器授权逻辑按 `controller / service / utils / config` 边界拆开，并完成文件命名治理，避免把复杂度继续堆进单一文件。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：`是`
  - 路由处理、会话校验、页面渲染、文案配置、样式配置、语言与文案辅助函数已分层。
- 目录结构与文件组织是否满足当前项目治理要求：`部分满足`
  - 本次触达文件的命名治理已经满足。
  - 但 `workers/nextclaw-provider-gateway-api/src` 根目录平铺仍然偏重，`lint:maintainability:guard` 也继续提示该目录预算偏高；本次未进一步做大规模目录搬迁，是为了避免把需求从“修登录页”扩大成一轮完整目录治理。
- 下一步整理入口：
  - 若后续平台账号页、remote 错误页、邮件模板页继续增长，应考虑把 browser auth 相关文件进一步收敛到单独子目录，降低 `src` 根目录平铺度。

## NPM 包发布记录

- 不涉及 NPM 包发布。
