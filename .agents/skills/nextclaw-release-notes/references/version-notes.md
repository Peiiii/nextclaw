# 版本更新笔记

1. 运行 `pnpm release:summary -- --json`，读取未发布 changeset、packages、bump、候选截图和绑定博客。
2. 任一绑定博客仍为 `draft` 时，先生成中英文正式文章、更新两种语言的 blog index 与 sidebar，再把草稿 frontmatter 改为 `ready` 并补齐正式路径；不能从 release notes 中静默省略。
3. 基于 changeset、commit 区间与必要迭代证据写用户结果，分类只用功能/增强/修复/默认行为与兼容性。
4. 默认产物：`apps/docs/zh|en/notes/...`、对应 index、`apps/docs/public/release-notes/nextclaw-v<version>.json`。
5. Stable NPM minor 必须补齐中英文页面和结构化 JSON；缺失时不得继续，除非用户明确接受延期并记录。
6. JSON schema v1 保持 `product/version/channel/releaseType/publishedAt/title/summary/links/sections`，section kind 只用 feature/enhancement/fix/compatibility。
7. Runtime/desktop manifest、GitHub release 与 docs URL 对齐；公开 URL、CORS headers 和 JSON 内容发布后验证。博客严格门位于 `NPM_READY` 之后、runtime/docs 产品闭环之前，不能前置阻塞 NPM 发布；线上验证完成后清理内部草稿。

GitHub Release 正文是独立的用户可见发布产物，不能直接复用单一语言的 docs 源文件。正文必须使用 GitHub 可直接渲染的双语 Markdown：`## 中文` 在前、`## English` 在后；不带 docs YAML frontmatter；中英文区分别链接绝对地址的完整更新说明；不使用站内相对链接；不追加自动生成的 commit 列表、`What's Changed` 或与本次产品发布无关的 PR 噪音。

正文不写测试、治理、skill、内部讨论和分类过程；每类真实内容不足不凑数。
