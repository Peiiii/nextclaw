export const PLATFORM_ADMIN_SMOKE_FIXTURES = {
  user: {
    id: "admin-1",
    email: "admin@example.com",
    username: "admin",
    role: "admin",
    freeLimitUsd: 50,
    freeUsedUsd: 12.5,
    freeRemainingUsd: 37.5,
    paidBalanceUsd: 100,
    createdAt: "2026-04-18T08:00:00.000Z",
    updatedAt: "2026-04-18T09:00:00.000Z"
  },
  overview: {
    globalFreeLimitUsd: 200,
    globalFreeUsedUsd: 72.5,
    globalFreeRemainingUsd: 127.5,
    userCount: 24,
    pendingRechargeIntents: 2
  },
  remoteQuota: {
    dayKey: "2026-04-18",
    resetsAt: "2026-04-19T00:00:00.000Z",
    reservePercent: 15,
    sessionRequestsPerMinute: 180,
    instanceConnectionsPerInstance: 10000,
    defaultUserWorkerBudget: 300,
    defaultUserDoBudget: 600,
    workerRequests: {
      configuredLimit: 50000,
      enforcedLimit: 42500,
      used: 1876,
      remaining: 40624
    },
    durableObjectRequests: {
      configuredLimit: 90000,
      enforcedLimit: 76500,
      used: 6321.5,
      remaining: 70178.5
    }
  },
  marketplaceList: {
    counts: {
      pending: 3,
      published: 25,
      rejected: 1
    },
    total: 3,
    page: 1,
    pageSize: 12,
    totalPages: 1,
    publishStatus: "pending",
    items: [
      {
        id: "skill-1",
        slug: "stock-briefing",
        packageName: "@peiiii/stock-briefing",
        ownerScope: "@peiiii",
        skillName: "stock-briefing",
        name: "Stock Briefing",
        summary: "Summarize the latest market signals for a watchlist.",
        author: "peiiii",
        tags: ["market", "finance"],
        publishStatus: "pending",
        publishedByType: "user",
        reviewNote: "",
        publishedAt: "2026-04-18T08:00:00.000Z",
        updatedAt: "2026-04-18T09:00:00.000Z"
      }
    ]
  },
  marketplaceDetail: {
    item: {
      id: "skill-1",
      slug: "stock-briefing",
      packageName: "@peiiii/stock-briefing",
      ownerScope: "@peiiii",
      skillName: "stock-briefing",
      name: "Stock Briefing",
      summary: "Summarize the latest market signals for a watchlist.",
      author: "peiiii",
      tags: ["market", "finance"],
      publishStatus: "pending",
      publishedByType: "user",
      reviewNote: "",
      publishedAt: "2026-04-18T08:00:00.000Z",
      updatedAt: "2026-04-18T09:00:00.000Z",
      summaryI18n: {
        en: "Summarize the latest market signals for a watchlist.",
        zh: "为股票观察列表生成市场简报。"
      },
      description: "Read the market data source, summarize trends, and prepare an action-oriented briefing.",
      descriptionI18n: {
        zh: "读取行情源，提炼趋势，并整理成面向决策的简报。"
      },
      sourceRepo: "https://github.com/peiiii/stock-briefing",
      homepage: "https://nextclaw.io",
      install: {
        kind: "git",
        spec: "peiiii/stock-briefing"
      }
    },
    files: [
      {
        path: "SKILL.md",
        sha256: "demo",
        sizeBytes: 128,
        updatedAt: "2026-04-18T09:00:00.000Z"
      }
    ],
    skillMarkdownRaw: "# Stock Briefing\n\nProduce a market briefing for a watchlist.",
    marketplaceJsonRaw: "{\n  \"name\": \"Stock Briefing\"\n}"
  },
  usersPage: {
    items: [
      {
        id: "user-1",
        email: "alice@example.com",
        username: "alice",
        role: "user",
        freeLimitUsd: 20,
        freeUsedUsd: 5,
        freeRemainingUsd: 15,
        paidBalanceUsd: 30,
        createdAt: "2026-04-18T08:00:00.000Z",
        updatedAt: "2026-04-18T09:00:00.000Z"
      }
    ],
    total: 1,
    pageSize: 20,
    nextCursor: null,
    hasMore: false
  },
  rechargePage: {
    items: [
      {
        id: "intent-1",
        userId: "user-1",
        amountUsd: 20,
        status: "pending",
        note: null,
        createdAt: "2026-04-18T09:30:00.000Z",
        updatedAt: "2026-04-18T09:30:00.000Z",
        confirmedAt: null,
        confirmedByUserId: null,
        rejectedAt: null,
        rejectedByUserId: null
      }
    ],
    nextCursor: null,
    hasMore: false
  },
  providers: {
    items: [
      {
        id: "provider-1",
        provider: "dashscope",
        displayName: "DashScope Main",
        authType: "oauth",
        apiBase: "https://dashscope.aliyuncs.com/compatible-mode/v1",
        tokenSet: true,
        enabled: true,
        priority: 100,
        createdAt: "2026-04-18T08:00:00.000Z",
        updatedAt: "2026-04-18T09:00:00.000Z"
      }
    ]
  },
  models: {
    items: [
      {
        publicModelId: "openai/gpt-4o",
        providerAccountId: "provider-1",
        upstreamModel: "qwen-plus",
        displayName: "Qwen Plus Proxy",
        enabled: true,
        sellInputUsdPer1M: 6,
        sellOutputUsdPer1M: 18,
        upstreamInputUsdPer1M: 2.4,
        upstreamOutputUsdPer1M: 7.2,
        createdAt: "2026-04-18T08:00:00.000Z",
        updatedAt: "2026-04-18T09:00:00.000Z"
      }
    ]
  },
  profit: {
    days: 7,
    since: "2026-04-11T00:00:00.000Z",
    requests: 320,
    totalChargeUsd: 210.55,
    totalUpstreamCostUsd: 134.12,
    totalGrossMarginUsd: 76.43,
    grossMarginRate: 0.363
  }
};
