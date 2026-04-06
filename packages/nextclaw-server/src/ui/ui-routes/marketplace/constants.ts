export const DEFAULT_MARKETPLACE_API_BASE = "https://marketplace-api.nextclaw.io";

export const NEXTCLAW_PLUGIN_NPM_PREFIX = "@nextclaw/channel-plugin-";
export const CLAWBAY_CHANNEL_PLUGIN_NPM_SPEC = "@clawbay/clawbay-channel";
export const BUILTIN_CHANNEL_PLUGIN_ID_PREFIX = "builtin-channel-";
export const MARKETPLACE_REMOTE_PAGE_SIZE = 100;
export const MARKETPLACE_REMOTE_MAX_PAGES = 20;

export const MARKETPLACE_ZH_COPY_BY_SLUG: Record<string, { summary: string; description?: string }> = {
  weather: {
    summary: "NextClaw 内置技能，用于天气查询工作流。",
    description: "在 NextClaw 中提供快速天气查询工作流。"
  },
  summarize: {
    summary: "NextClaw 内置技能，用于结构化摘要。",
    description: "在 NextClaw 中提供文件与长文本的摘要工作流。"
  },
  github: {
    summary: "NextClaw 内置技能，用于 GitHub 工作流。",
    description: "在 NextClaw 中提供 Issue、PR 与仓库相关工作流指引。"
  },
  tmux: {
    summary: "NextClaw 内置技能，用于终端/Tmux 协作工作流。",
    description: "在 NextClaw 中提供基于 Tmux 的任务执行工作流指引。"
  },
  gog: {
    summary: "NextClaw 内置技能，用于图谱导向生成工作流。",
    description: "在 NextClaw 中提供图谱与规划导向工作流指引。"
  },
  pdf: {
    summary: "Anthropic 技能，用于 PDF 读取/合并/拆分/OCR 工作流。",
    description: "使用该技能可读取、提取、合并、拆分、旋转并对 PDF 执行 OCR 处理。"
  },
  docx: {
    summary: "Anthropic 技能，用于创建和编辑 Word 文档。",
    description: "使用该技能可创建、读取、编辑并重构 .docx 文档。"
  },
  pptx: {
    summary: "Anthropic 技能，用于演示文稿操作。",
    description: "使用该技能可创建、解析、编辑并重组 .pptx 演示文稿。"
  },
  xlsx: {
    summary: "Anthropic 技能，用于表格文档工作流。",
    description: "使用该技能可打开、编辑、清洗并转换 .xlsx 与 .csv 等表格文件。"
  },
  bird: {
    summary: "OpenClaw 社区技能，用于 X/Twitter 读取/搜索/发布工作流。",
    description: "使用 bird CLI 在代理工作流中读取线程、搜索帖子并起草推文/回复。"
  },
  "cloudflare-deploy": {
    summary: "OpenAI 精选技能，用于在 Cloudflare 上部署应用与基础设施。",
    description: "使用该技能可选择 Cloudflare 产品并部署 Workers、Pages 及相关服务。"
  },
  "channel-plugin-discord": {
    summary: "NextClaw 官方插件，用于 Discord 渠道集成。",
    description: "通过 NextClaw 插件运行时提供 Discord 渠道的入站/出站支持。"
  },
  "channel-plugin-telegram": {
    summary: "NextClaw 官方插件，用于 Telegram 渠道集成。",
    description: "通过 NextClaw 插件运行时提供 Telegram 渠道的入站/出站支持。"
  },
  "channel-plugin-slack": {
    summary: "NextClaw 官方插件，用于 Slack 渠道集成。",
    description: "通过 NextClaw 插件运行时提供 Slack 渠道的入站/出站支持。"
  },
  "channel-plugin-wecom": {
    summary: "NextClaw 官方插件，用于企业微信渠道集成。",
    description: "通过 NextClaw 插件运行时提供企业微信渠道的入站/出站支持。"
  },
  "channel-plugin-email": {
    summary: "NextClaw 官方插件，用于 Email 渠道集成。",
    description: "通过 NextClaw 插件运行时提供 Email 渠道的入站/出站支持。"
  },
  "channel-plugin-whatsapp": {
    summary: "NextClaw 官方插件，用于 WhatsApp 渠道集成。",
    description: "通过 NextClaw 插件运行时提供 WhatsApp 渠道的入站/出站支持。"
  },
  "channel-plugin-clawbay": {
    summary: "Clawbay 官方渠道插件，用于 NextClaw 集成。",
    description: "通过插件运行时为 NextClaw 提供 Clawbay 渠道能力。"
  }
};
