export const projectPulseCopy = {
  en: {
    eyebrow: 'Project Pulse',
    title: 'A public view into how NextClaw keeps shipping.',
    summary:
      'This page turns engineering movement into a product signal: how the codebase grows, how often we ship, what we are improving, and what the product looks like right now.',
    heroCaption: 'Not a metrics wall. A product pulse for a unified AI operating layer.',
    stats: {
      loc: 'Current source LOC',
      commits: 'Commits in 30 days',
      releases: 'Release batches in 90 days',
      note: 'Latest product note',
      benchmark: 'Size vs OpenClaw'
    },
    sections: {
      trends: 'Rhythm',
      structure: 'Current Shape',
      timeline: 'Product Timeline',
      gallery: 'Current Screens',
      trust: 'How To Read This'
    },
    cards: {
      loc: {
        title: 'Source LOC trend',
        description: 'A running signal of implementation scope, not a quality score by itself.'
      },
      commits: {
        title: 'Commit rhythm',
        description: 'Switch between daily and weekly views to read short-term execution and broader delivery cadence.'
      },
      releases: {
        title: 'Monthly release rhythm',
        description: 'Release batches grouped by tag days instead of raw tag count.'
      },
      scopes: {
        title: 'Top scopes by code volume',
        description: 'Where the current implementation footprint is concentrated.'
      },
      benchmark: {
        title: 'Benchmark snapshot',
        description: 'We compare source LOC against OpenClaw to keep complexity visible.'
      },
      releaseBatches: {
        title: 'Recent release batches',
        description: 'Latest tag days and how many packages moved together.'
      },
      timeline: {
        title: 'Recent product notes',
        description: 'Public milestones that matter to users, not just internal diffs.'
      },
      gallery: {
        title: 'Automated screenshot gallery',
        description: 'These images are refreshed through our existing screenshot automation.'
      }
    },
    benchmarkLine: 'NextClaw is {percent}% of {name} source LOC.',
    lighterLine: '{percent}% lighter by source LOC.',
    tags: 'Tags',
    releaseCountSuffix: 'packages',
    filesSuffix: 'files',
    activeDays: '{count} active days',
    updatedOn: 'Updated',
    screenshotRefresh: 'Latest screenshot refresh',
    chart: {
      latest: 'Latest',
      delta: 'Change',
      total: 'Since start',
      peak: 'Peak',
      low: 'Low',
      hoverHint: 'Hover the chart for exact values.',
      locUnit: 'LOC',
      commitUnit: 'commits',
      releaseUnit: 'batches',
      locDeltaLabel: 'vs previous snapshot',
      commitDailyDeltaLabel: 'vs previous day',
      commitWeeklyDeltaLabel: 'vs previous week',
      releaseDeltaLabel: 'vs previous month',
      locWindow: 'Recent source snapshot window',
      commitDailyWindow: '30-day daily commit rhythm',
      commitWeeklyWindow: '12-week delivery rhythm',
      releaseWindow: '12-month release rhythm'
    },
    controls: {
      daily: 'Daily',
      weekly: 'Weekly'
    },
    trustPoints: [
      'We intentionally expose a small set of metrics with product meaning instead of publishing every internal engineering signal.',
      'Release rhythm is grouped by release days, because raw tag counts would mostly reflect monorepo package count rather than product cadence.',
      'Source LOC is tracked as a maintainability trend, not as a vanity metric. We use it together with scope distribution and note timelines.'
    ]
  },
  zh: {
    eyebrow: 'Project Pulse',
    title: '把 NextClaw 的持续交付节奏公开展示出来。',
    summary:
      '这个页面把工程变化变成产品信号：代码规模怎么变化、最近发版有多频繁、产品最近在推进什么、现在的产品长什么样。',
    heroCaption: '不是报表墙，而是面向统一 AI 操作层的产品脉搏页。',
    stats: {
      loc: '当前源码 LOC',
      commits: '近 30 天 commits',
      releases: '近 90 天 release 批次',
      note: '最近产品更新',
      benchmark: '相对 OpenClaw 体积'
    },
    sections: {
      trends: '节奏',
      structure: '当前形态',
      timeline: '产品演进',
      gallery: '当前画面',
      trust: '如何理解这些数据'
    },
    cards: {
      loc: {
        title: '源码 LOC 趋势',
        description: '这是实现范围的持续信号，不是单独的质量评分。'
      },
      commits: {
        title: 'commit 节奏',
        description: '支持在日级和周级之间切换，同时看清短期执行密度与整体交付节奏。'
      },
      releases: {
        title: '每月 release 节奏',
        description: '按 release 日期分组，而不是按 monorepo 标签总数堆数字。'
      },
      scopes: {
        title: '当前代码体积 Top scopes',
        description: '看清当前实现体积主要集中在哪些区域。'
      },
      benchmark: {
        title: '基准对比',
        description: '持续把复杂度放到可见处，而不是只看自己内部增长。'
      },
      releaseBatches: {
        title: '近期 release 批次',
        description: '最近的 tag 日期，以及每次联动了多少包。'
      },
      timeline: {
        title: '近期产品笔记',
        description: '优先展示用户能感知到的重要演进，而不是只列内部 diff。'
      },
      gallery: {
        title: '自动化截图展示',
        description: '这些截图与现有截图自动化链路保持一致。'
      }
    },
    benchmarkLine: 'NextClaw 当前是 {name} 源码 LOC 的 {percent}%。',
    lighterLine: '按源码 LOC 计算，当前轻了 {percent}%。',
    tags: '标签',
    releaseCountSuffix: '个包',
    filesSuffix: '个文件',
    activeDays: '{count} 个活跃日',
    updatedOn: '更新于',
    screenshotRefresh: '最近截图刷新时间',
    chart: {
      latest: '最新值',
      delta: '变化',
      total: '相对起点',
      peak: '峰值',
      low: '低点',
      hoverHint: '悬停图表可查看精确数值。',
      locUnit: 'LOC',
      commitUnit: 'commits',
      releaseUnit: '批次',
      locDeltaLabel: '较上一快照',
      commitDailyDeltaLabel: '较上一天',
      commitWeeklyDeltaLabel: '较上一周',
      releaseDeltaLabel: '较上一月',
      locWindow: '近期源码快照窗口',
      commitDailyWindow: '近 30 天每日 commit 节奏',
      commitWeeklyWindow: '近 12 周交付节奏',
      releaseWindow: '近 12 个月发版节奏'
    },
    controls: {
      daily: '每日',
      weekly: '每周'
    },
    trustPoints: [
      '这里故意只公开少量真正有产品叙事价值的指标，而不是把所有内部工程噪音都摊出来。',
      'release 节奏按“发版日”而不是 tag 总数统计，否则在 monorepo 下只会放大包数量，而不是产品节奏。',
      '源码 LOC 只是可维护性趋势信号之一，需要结合 scope 分布和产品时间线一起看。'
    ]
  }
} as const
