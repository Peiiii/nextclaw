#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  copyGalleryAssets,
  createDayRange,
  readCommitSeries,
  readJson,
  readLocHistory,
  readNotesTimeline,
  readReleaseSeries,
  resolveFirstExisting,
  safeNumber
} from "./data-core.mjs";
import { resolveRepoPath } from "../shared/repo-paths.mjs";

const rootDir = resolveRepoPath(import.meta.url);
const latestMetricsPath = resolve(rootDir, "docs/metrics/code-volume/latest.json");
const historyMetricsPath = resolve(rootDir, "docs/metrics/code-volume/history.jsonl");
const comparisonMetricsPath = resolve(rootDir, "docs/metrics/code-volume/comparison.json");
const docsDataModulePath = resolve(rootDir, "apps/docs/.vitepress/data/project-pulse.generated.mjs");
const docsPublicGalleryDir = resolve(rootDir, "apps/docs/public/project-pulse/gallery");
const notesRootEn = resolve(rootDir, "apps/docs/en/notes");
const notesRootZh = resolve(rootDir, "apps/docs/zh/notes");
const now = new Date();

const galleryItems = [
  {
    key: "chat",
    title: {
      en: "Unified chat workspace",
      zh: "统一对话工作台"
    },
    description: {
      en: "Sessions, project context, model selection, and tool execution in one surface.",
      zh: "把会话、项目上下文、模型选择和工具执行收敛在同一入口。"
    },
    sources: {
      en: resolveFirstExisting(
        resolve(rootDir, "images/screenshots/nextclaw-chat-page-en.png"),
        resolve(rootDir, "apps/landing/public/nextclaw-chat-page-en.png")
      ),
      zh: resolveFirstExisting(
        resolve(rootDir, "images/screenshots/nextclaw-chat-page-cn.png"),
        resolve(rootDir, "apps/landing/public/nextclaw-chat-page-cn.png")
      )
    }
  },
  {
    key: "providers",
    title: {
      en: "Provider control plane",
      zh: "Provider 控制面"
    },
    description: {
      en: "Switch models and providers without fragmenting the user experience.",
      zh: "在统一体验下管理模型与 provider，而不是把入口打散。"
    },
    sources: {
      en: resolveFirstExisting(
        resolve(rootDir, "images/screenshots/nextclaw-providers-page-en.png"),
        resolve(rootDir, "apps/landing/public/nextclaw-providers-page-en.png")
      ),
      zh: resolveFirstExisting(
        resolve(rootDir, "images/screenshots/nextclaw-providers-page-cn.png"),
        resolve(rootDir, "apps/landing/public/nextclaw-providers-page-cn.png")
      )
    }
  },
  {
    key: "channels",
    title: {
      en: "Channel orchestration",
      zh: "渠道编排"
    },
    description: {
      en: "Operate multiple external channels through one consistent management model.",
      zh: "把多个外部渠道纳入一个统一、可管理的操作模型。"
    },
    sources: {
      en: resolveFirstExisting(
        resolve(rootDir, "images/screenshots/nextclaw-channels-page-en.png"),
        resolve(rootDir, "apps/landing/public/nextclaw-channels-page-en.png")
      ),
      zh: resolveFirstExisting(
        resolve(rootDir, "images/screenshots/nextclaw-channels-page-cn.png"),
        resolve(rootDir, "apps/landing/public/nextclaw-channels-page-cn.png")
      )
    }
  },
  {
    key: "skills",
    title: {
      en: "Skills and embedded docs",
      zh: "Skills 与内嵌文档"
    },
    description: {
      en: "Skill discovery and documentation stay close to the product instead of living in separate tools.",
      zh: "Skill 发现与文档阅读贴近产品主界面，而不是散落在外部工具里。"
    },
    sources: {
      en: resolveFirstExisting(
        resolve(rootDir, "images/screenshots/nextclaw-skills-doc-browser-en.png"),
        resolve(rootDir, "apps/landing/public/nextclaw-skills-doc-browser-en.png")
      ),
      zh: resolveFirstExisting(
        resolve(rootDir, "images/screenshots/nextclaw-skills-doc-browser-cn.png"),
        resolve(rootDir, "apps/landing/public/nextclaw-skills-doc-browser-cn.png")
      )
    }
  },
  {
    key: "micro-browser",
    title: {
      en: "Micro browser dock",
      zh: "微浏览器停靠模式"
    },
    description: {
      en: "Product documentation and workflows remain within the same operating surface.",
      zh: "让文档与工作流留在同一操作表面内。"
    },
    sources: {
      en: resolveFirstExisting(
        resolve(rootDir, "images/screenshots/nextclaw-micro-browser-dock-en.png"),
        resolve(rootDir, "apps/landing/public/nextclaw-micro-browser-dock-en.png")
      ),
      zh: resolveFirstExisting(
        resolve(rootDir, "images/screenshots/nextclaw-micro-browser-dock-cn.jpg"),
        resolve(rootDir, "apps/landing/public/nextclaw-micro-browser-dock-cn.jpg")
      )
    }
  }
];

const latestMetrics = readJson(latestMetricsPath, {
  totals: { codeLines: 0, totalLines: 0, files: 0 },
  byScope: [],
  scope: { profile: "source" },
  generatedAt: ""
});
const comparisonMetrics = readJson(comparisonMetricsPath, {
  benchmark: { name: "openclaw", totals: { codeLines: 0 } },
  comparison: { basePercentOfBenchmark: 0, benchmarkMultipleOfBase: 0, baseIsLighterByPercent: 0 }
});
const locHistory = readLocHistory(historyMetricsPath);
const commitMetrics = readCommitSeries({ rootDir, now });
const releaseMetrics = readReleaseSeries({ rootDir, now });
const notesTimeline = readNotesTimeline({ notesRootEn, notesRootZh });
const gallery = copyGalleryAssets({ rootDir, docsPublicGalleryDir, galleryItems });

const dailyLocSeries = (() => {
  const fallbackDays = createDayRange(now, 120);
  const firstHistoryDate = locHistory[0]?.date ?? "";
  const firstVisibleDate = firstHistoryDate && firstHistoryDate > fallbackDays[0] ? firstHistoryDate : fallbackDays[0];
  const recentDays = fallbackDays.filter((day) => day >= firstVisibleDate);
  const historyByDay = new Map(locHistory.map((entry) => [entry.date, entry.value]));
  let lastValue = 0;
  return recentDays.map((day) => {
    if (historyByDay.has(day)) {
      lastValue = historyByDay.get(day) ?? lastValue;
    }
    return {
      key: day,
      label: day.slice(5),
      value: lastValue
    };
  });
})();

const topScopes = (latestMetrics.byScope ?? []).slice(0, 8).map((scope) => ({
  name: scope.name,
  codeLines: safeNumber(scope.codeLines),
  files: safeNumber(scope.files),
  sharePercent:
    safeNumber(latestMetrics.totals?.codeLines) > 0
      ? Number(((safeNumber(scope.codeLines) / safeNumber(latestMetrics.totals.codeLines)) * 100).toFixed(1))
      : 0
}));

const payload = {
  generatedAt: now.toISOString(),
  hero: {
    currentLoc: safeNumber(latestMetrics.totals?.codeLines),
    trackedFiles: safeNumber(latestMetrics.totals?.files),
    recentCommitCount: commitMetrics.totals.recent30Count,
    activeDays30: commitMetrics.totals.activeDays30,
    recentReleaseCount: releaseMetrics.totals.recent90Count,
    latestReleaseDate: releaseMetrics.totals.lastReleaseDate,
    latestNoteDate: notesTimeline[0]?.date ?? "",
    benchmarkName: comparisonMetrics.benchmark?.name ?? "openclaw",
    benchmarkCodeLines: safeNumber(comparisonMetrics.benchmark?.totals?.codeLines),
    basePercentOfBenchmark: safeNumber(comparisonMetrics.comparison?.basePercentOfBenchmark),
    lighterByPercent: safeNumber(comparisonMetrics.comparison?.baseIsLighterByPercent)
  },
  trends: {
    locDaily: dailyLocSeries,
    commitDaily: commitMetrics.dailySeries,
    commitWeekly: commitMetrics.weeklySeries,
    releaseMonthly: releaseMetrics.monthlySeries
  },
  breakdown: {
    topScopes,
    benchmark: {
      name: comparisonMetrics.benchmark?.name ?? "openclaw",
      benchmarkCodeLines: safeNumber(comparisonMetrics.benchmark?.totals?.codeLines),
      basePercentOfBenchmark: safeNumber(comparisonMetrics.comparison?.basePercentOfBenchmark),
      lighterByPercent: safeNumber(comparisonMetrics.comparison?.baseIsLighterByPercent)
    },
    recentReleaseBatches: releaseMetrics.recentBatches
  },
  timeline: {
    notes: notesTimeline
  },
  gallery,
  meta: {
    locProfile: latestMetrics.scope?.profile ?? "source",
    locGeneratedAt: latestMetrics.generatedAt ?? "",
    sourceCount: {
      notes: notesTimeline.length,
      scopes: topScopes.length
    }
  }
};

mkdirSync(dirname(docsDataModulePath), { recursive: true });
writeFileSync(docsDataModulePath, `export default ${JSON.stringify(payload, null, 2)};\n`, "utf8");

console.log("Project Pulse data generated.");
console.log(`- Output: ${docsDataModulePath}`);
console.log(`- LOC: ${payload.hero.currentLoc}`);
console.log(`- Commits (30d): ${payload.hero.recentCommitCount}`);
console.log(`- Release batches (90d): ${payload.hero.recentReleaseCount}`);
