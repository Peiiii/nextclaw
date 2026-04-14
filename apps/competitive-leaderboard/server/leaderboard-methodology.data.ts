import type {
  ChangeLogEntry,
  LeaderboardMethodology
} from "../shared/competitive-leaderboard.types.js";

export const LEADERBOARD_GENERATED_AT = "2026-04-14T23:05:00+08:00";

export const LEADERBOARD_METHODOLOGY_VERSION = "2026.04.14-universe-tightened";

export const DISCLOSURES: string[] = [
  "This index is maintained by the NextClaw team. NextClaw is one of the evaluated products.",
  "Only core comparable products enter the unified overall ranking.",
  "All inclusion and capability statements in this app are derived from official public sources checked on 2026-04-14.",
  "Products that are clearly not lobster-class are excluded from this app instead of being shown as if they belong to the same product universe.",
  "Derivative forks, wrappers, and lightweight reimplementations may appear in watch tier, but they do not enter the unified total ranking."
];

export const METHODOLOGY: LeaderboardMethodology = {
  definition:
    "这里的“龙虾类产品”不是所有 AI 应用，而是以个人 AI 助手、个人 AI OS、长期自持 AI 入口或类似心智为核心的产品族群。",
  inclusionRules: [
    "统一总榜只收 core comparable 层。core 层要求产品至少明确是独立 assistant / AI OS / 长期 agent 入口，而不是 chat UI、builder、workspace 或 suite 附属助手。",
    "进入 core 不只要“像”，还要足够适合同类混排：应是相对通用、面向广泛用户、公开证据足够完整的主产品，而不是窄场景、边界型或公开资料仍偏早期的样本。",
    "所有纳入判断都优先看官方仓库、官方 README、官方文档和官方网站，不使用内部营销稿、二手评测或社区转述作为主要证据。",
    "如果一个产品明显不是龙虾类产品，就直接排除，不再为了“看起来全面”而把它塞进同一张榜单。"
  ],
  tierRules: [
    "Core：满足独立 assistant / AI OS 心智，且公开资料能证明它具备本地 / 自托管边界、行动层与官方文档入口，同时足够适合作为主流同类产品统一比较。",
    "Watch：保留直接衍生物、fork、wrapper、轻量重实现，以及边界型 / 早期型 / 窄场景龙虾类样本，用于观察生态走向，但它们不参与统一总榜。",
    "Exclude：chat UI、workflow platform、workspace、knowledge assistant、suite-native assistant 等非龙虾类产品，直接移出这张榜。"
  ],
  scoringFormula: [
    "公共信号 40 分：GitHub stars 18 分、forks 8 分、最近活跃度 6 分、官方文档存在 4 分、开源许可证清晰度 4 分。",
    "能力覆盖 60 分：10 个公开可验证能力项等权计分，每项 6 分；状态为 yes 得 6 分，partial 得 3 分，no 得 0 分。",
    "总分 = 公共信号分 + 能力覆盖分；只有 core 产品才计算统一总分。"
  ],
  exclusions: [
    "闭源且缺少公开能力证据的产品不进统一总榜。",
    "官方主定位如果是 chat UI、workflow platform、agent builder、AI workspace 或 suite 内置 assistant，则不进入 core 总榜。",
    "没有公开证据支撑的能力点默认不给分，不因为“看起来应该有”而补分。"
  ],
  reviewedExclusions: [
    {
      name: "腾讯元器",
      reason: "腾讯官方明确把它定义为“AI 智能体创建与分发平台”与“智能体创作工具”，更接近 builder / distribution platform，而不是独立 self-hosted 个人 AI 助手。",
      sourceTitle: "腾讯元器介绍",
      sourceUrl: "https://yuanqi.tencent.com/guide/yuanqi-introduction"
    },
    {
      name: "通义 APP",
      reason: "官方帮助中心把它描述为“你的全能AI助手”，但当前公开形态是闭源消费应用与频道化功能集合，缺少可与自托管龙虾类产品对称比较的公开运行边界，因此不进当前统一总榜。",
      sourceTitle: "通义帮助中心",
      sourceUrl: "https://tongyi.aliyun.com/blog/192631944"
    },
    {
      name: "有道云笔记 AI 工具",
      reason: "官方帮助中心明确写这是有道云笔记移动端深度整合的 AI 工具“百宝箱”，属于宿主产品内的 suite-native assistant，而不是独立龙虾类产品。",
      sourceTitle: "有道云笔记帮助中心",
      sourceUrl: "https://note.youdao.com/help-center/advance_ai.html"
    }
  ],
  notes: [
    "这个榜单更像一套研究型索引，而不是营销式冠军榜。总分只是入口，真正的可信度来自纳入标准、能力矩阵和证据抽屉。",
    "高声量不等于高能力，强能力也不等于强声量，所以页面同时展示公共信号和能力覆盖。",
    "当前版本宁可漏掉边界不清的产品，也不愿意把非龙虾类产品混进来降低可信度。",
    "大厂产品不是天然应该进榜。只要官方主定位更像平台、宿主功能或闭源消费助手，而不是可对称比较的龙虾类主产品，就会被公开记名排除。"
  ]
};

export const CHANGE_LOG: ChangeLogEntry[] = [
  {
    date: "2026-04-14",
    summary: "完全废弃旧版主观 rawScore 模型，改成官方公开证据驱动的纳入规则、公共信号和能力矩阵。"
  },
  {
    date: "2026-04-14",
    summary: "进一步收紧 universe：移出 Khoj、AnythingLLM、LibreChat、Open WebUI、Dify、Flowise、Jan 等非龙虾类产品，只保留 core 龙虾类与 watch 衍生物。"
  },
  {
    date: "2026-04-14",
    summary: "继续收紧 core：把 Sentient、OpenDAN、zclaw 降到 watch，并把腾讯元器、通义 APP、有道云笔记 AI 工具列为已审查但排除样本。"
  }
];
