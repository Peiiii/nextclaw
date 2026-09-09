# Landing 截图交付

`pnpm dev` 和 `pnpm build` 会先运行 `images:generate`。生成器读取源码引用，保留 `images/screenshots/` 高质量源图以及现有 public 源素材，为网页生成 640/960/1440/1920/2560px 与源图上限候选（不放大），输出 AVIF 65、WebP 85。文字截图使用 AVIF 4:4:4。

新截图优先放入仓库 `images/screenshots/`，配置引用 `/screenshots/<filename>`。现有 public 截图可以继续作为构建输入，但渲染必须调用 `renderScreenshot`，不能直接使用原图作为 img src。`originalScreenshot` 仅用于点击后查看原图。

产物在忽略目录 `public/assets/screenshots/`，文件名为内容 SHA-256 前 16 位，缓存按 `_headers` 中 `/assets/*` immutable 规则。生成的 JSON 清单只含 URL/尺寸，不内嵌图片字节；编码参数或源图变化会生成新内容地址。HTML 使用普通可更新缓存。

`pnpm images:check` 验证格式、实际候选尺寸、体积、原图链接和缓存配置。首页仅 Hero eager/high，其余截图 lazy/async，所有 picture 都声明尺寸和 sizes。WebP 同时作为不支持 AVIF 的浏览器源和 img 默认源。

启动生产预览后运行 `pnpm images:check-browser -- <base-url>`，检查中英文桌面/移动首页和截图路由的实际 AVIF 选择、原图链接、布局和媒体延迟加载。首屏以下视频接近视口后才加载视频与优化 poster。首页文案配置按语言保存在 `landing-copy-en.config.ts` 和 `landing-copy-zh.config.ts`，入口只负责页面装配。

`node scripts/measure-screenshot-loading.mjs <base-url> <output-directory>` 在桌面 1440px/DPR1 和手机 390px/DPR2、中英文首页上记录 100ms RTT、200KB/s 冷缓存的请求瀑布、LCP、CLS 和截图。比较时两边必须使用同一构建模式；本地结果不是线上指标。生产部署后还需核对真实响应头和页面资源。
