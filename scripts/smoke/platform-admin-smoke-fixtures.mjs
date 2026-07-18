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
    costModel: {
      version: 2,
      verifiedAt: "2026-07-18",
      observedThrough: "2026-07-18T09:30:00.000Z",
      partialDay: false,
      stale: false
    },
    day: {
      startsAt: "2026-07-18T00:00:00.000Z",
      resetsAt: "2026-07-19T00:00:00.000Z",
      status: "normal",
      utilization: 0.08,
      limitingResource: "durable_object_requests",
      workerRequests: {
        configuredLimit: 100000,
        limit: 80000,
        actualUsed: 1876,
        reserved: 0,
        remaining: 78124
      },
      durableObjectRequests: {
        configuredLimit: 100000,
        limit: 80000,
        actualUsed: 6321.5,
        reserved: 12.5,
        remaining: 73666
      }
    },
    recent: {
      bucketSeconds: 300,
      last30Minutes: { workerRequests: 42, durableObjectRequests: 64.5 },
      lastHour: { workerRequests: 88, durableObjectRequests: 121.25 },
      buckets: []
    },
    protection: { runawayGuard: "shadow", activeUntil: null },
    reservePercent: 15,
    instanceConnectionsPerInstance: 10000,
    defaultUserWorkerBudget: 20000,
    defaultUserDoBudget: 20000,
    plan: {
      id: "workers-free",
      resetsAt: "00:00Z",
      workerRequestsPerDay: 100000,
      durableObjectRequestsPerDay: 100000
    },
    calibration: {
      status: "bootstrap_capacity_contract",
      safetyReservePercent: 20,
      supportedHeavyUsers: 4,
      basis: "official_free_limit_minus_shared_platform_reserve"
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
