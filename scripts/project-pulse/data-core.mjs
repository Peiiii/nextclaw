import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync
} from "node:fs";
import { basename, extname, resolve } from "node:path";

export const parseDate = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  return new Date(`${value}T00:00:00Z`);
};

export const formatDateKey = (date) => date.toISOString().slice(0, 10);
export const formatMonthKey = (date) => date.toISOString().slice(0, 7);
export const shortLabel = (value) => value.slice(5);
export const monthLabel = (value) => {
  const [year, month] = value.split("-");
  return `${month}/${year.slice(2)}`;
};
export const safeNumber = (value) => (typeof value === "number" && Number.isFinite(value) ? value : 0);

export const readJson = (filePath, fallback) => {
  if (!existsSync(filePath)) {
    return fallback;
  }
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
};

export const runGit = (rootDir, args) => {
  try {
    return execFileSync("git", args, {
      cwd: rootDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
  } catch {
    return "";
  }
};

const parseFrontmatter = (content) => {
  if (!content.startsWith("---\n")) {
    return {};
  }
  const endIndex = content.indexOf("\n---\n", 4);
  if (endIndex < 0) {
    return {};
  }

  const block = content.slice(4, endIndex).trim();
  const fields = {};
  for (const line of block.split("\n")) {
    const separatorIndex = line.indexOf(":");
    if (separatorIndex < 0) {
      continue;
    }
    const key = line.slice(0, separatorIndex).trim();
    const value = line
      .slice(separatorIndex + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");
    fields[key] = value;
  }
  return fields;
};

export const createDayRange = (now, days) => {
  const series = [];
  for (let index = days - 1; index >= 0; index -= 1) {
    const current = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - index));
    series.push(formatDateKey(current));
  }
  return series;
};

export const startOfIsoWeek = (date) => {
  const result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = result.getUTCDay() || 7;
  result.setUTCDate(result.getUTCDate() - day + 1);
  return result;
};

const createWeekRange = (now, weeks) => {
  const currentWeek = startOfIsoWeek(now);
  const series = [];
  for (let index = weeks - 1; index >= 0; index -= 1) {
    const current = new Date(currentWeek);
    current.setUTCDate(current.getUTCDate() - index * 7);
    series.push(formatDateKey(current));
  }
  return series;
};

const createMonthRange = (now, months) => {
  const series = [];
  for (let index = months - 1; index >= 0; index -= 1) {
    const current = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - index, 1));
    series.push(formatMonthKey(current));
  }
  return series;
};

export const readLocHistory = (historyMetricsPath) => {
  if (!existsSync(historyMetricsPath)) {
    return [];
  }

  const latestByDay = new Map();
  const lines = readFileSync(historyMetricsPath, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      const dayKey = typeof entry.generatedAt === "string" ? entry.generatedAt.slice(0, 10) : "";
      if (!dayKey) {
        continue;
      }
      latestByDay.set(dayKey, {
        date: dayKey,
        value: safeNumber(entry.codeLines)
      });
    } catch {
      // Ignore malformed history rows.
    }
  }

  return [...latestByDay.values()].sort((left, right) => left.date.localeCompare(right.date));
};

export const readCommitSeries = ({ rootDir, now }) => {
  const logOutput = runGit(rootDir, ["log", "--date=short", "--pretty=format:%ad", "--since=365 days ago", "HEAD"]);
  const commitDays = logOutput
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const countsByDay = new Map();
  for (const day of commitDays) {
    countsByDay.set(day, (countsByDay.get(day) ?? 0) + 1);
  }

  const recent30Days = new Set(createDayRange(now, 30));
  let recent30Count = 0;
  let activeDays30 = 0;
  for (const dayKey of recent30Days) {
    const count = countsByDay.get(dayKey) ?? 0;
    recent30Count += count;
    if (count > 0) {
      activeDays30 += 1;
    }
  }

  const weeks = createWeekRange(now, 12);
  const countsByWeek = new Map(weeks.map((week) => [week, 0]));
  for (const day of commitDays) {
    const parsed = parseDate(day);
    if (!parsed) {
      continue;
    }
    const weekKey = formatDateKey(startOfIsoWeek(parsed));
    if (!countsByWeek.has(weekKey)) {
      continue;
    }
    countsByWeek.set(weekKey, (countsByWeek.get(weekKey) ?? 0) + 1);
  }

  return {
    totals: {
      recent30Count,
      activeDays30
    },
    weeklySeries: weeks.map((week) => ({
      key: week,
      label: shortLabel(week),
      value: countsByWeek.get(week) ?? 0
    }))
  };
};

export const readReleaseSeries = ({ rootDir, now }) => {
  const rawTags = runGit(rootDir, [
    "for-each-ref",
    "--sort=creatordate",
    "--format=%(creatordate:short)|%(refname:short)",
    "refs/tags"
  ]);

  const batches = new Map();
  for (const line of rawTags.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    const [date, tag] = trimmed.split("|");
    if (!date || !tag) {
      continue;
    }
    if (!batches.has(date)) {
      batches.set(date, []);
    }
    batches.get(date).push(tag);
  }

  const batchList = [...batches.entries()]
    .map(([date, tags]) => ({
      date,
      tagCount: tags.length,
      sampleTags: tags.slice(0, 3)
    }))
    .sort((left, right) => right.date.localeCompare(left.date));

  const recent90Days = new Set(createDayRange(now, 90));
  const recent90Count = batchList.filter((item) => recent90Days.has(item.date)).length;
  const lastReleaseDate = batchList[0]?.date ?? "";

  const months = createMonthRange(now, 12);
  const countsByMonth = new Map(months.map((month) => [month, 0]));
  for (const batch of batchList) {
    const monthKey = batch.date.slice(0, 7);
    if (!countsByMonth.has(monthKey)) {
      continue;
    }
    countsByMonth.set(monthKey, (countsByMonth.get(monthKey) ?? 0) + 1);
  }

  return {
    totals: {
      recent90Count,
      lastReleaseDate
    },
    monthlySeries: months.map((month) => ({
      key: month,
      label: monthLabel(month),
      value: countsByMonth.get(month) ?? 0
    })),
    recentBatches: batchList.slice(0, 6)
  };
};

export const readNotesTimeline = ({ notesRootEn, notesRootZh }) => {
  const englishFiles = readdirSync(notesRootEn)
    .filter((fileName) => fileName.endsWith(".md") && fileName !== "index.md")
    .sort()
    .reverse();

  return englishFiles.map((fileName) => {
    const slug = basename(fileName, extname(fileName));
    const enPath = resolve(notesRootEn, fileName);
    const zhPath = resolve(notesRootZh, fileName);
    const date = slug.slice(0, 10);
    const enContent = readFileSync(enPath, "utf8");
    const zhContent = existsSync(zhPath) ? readFileSync(zhPath, "utf8") : "";
    const enFrontmatter = parseFrontmatter(enContent);
    const zhFrontmatter = zhContent ? parseFrontmatter(zhContent) : {};
    const tagsMatch = enContent.match(/^Tags:\s+(.+)$/m);
    const tags = tagsMatch
      ? tagsMatch[1]
          .split("`")
          .map((item) => item.trim())
          .filter(Boolean)
      : [];

    return {
      slug,
      date,
      tags,
      en: {
        title: enFrontmatter.title ?? slug,
        description: enFrontmatter.description ?? "",
        href: `/en/notes/${slug}`
      },
      zh: {
        title: zhFrontmatter.title ?? slug,
        description: zhFrontmatter.description ?? "",
        href: `/zh/notes/${slug}`
      }
    };
  });
};

export const resolveFirstExisting = (...paths) => paths.find((filePath) => existsSync(filePath)) ?? "";

export const copyGalleryAssets = ({ rootDir, docsPublicGalleryDir, galleryItems }) => {
  rmSync(docsPublicGalleryDir, { recursive: true, force: true });
  mkdirSync(docsPublicGalleryDir, { recursive: true });

  const copiedPaths = [];
  const items = galleryItems.map((item) => {
    const localeSources = {};
    for (const locale of ["en", "zh"]) {
      const sourcePath = item.sources[locale];
      if (!sourcePath) {
        continue;
      }
      const extension = extname(sourcePath).toLowerCase();
      const fileName = `${item.key}-${locale}${extension}`;
      const targetPath = resolve(docsPublicGalleryDir, fileName);
      copyFileSync(sourcePath, targetPath);
      copiedPaths.push(sourcePath);
      localeSources[locale] = `/project-pulse/gallery/${fileName}`;
    }

    return {
      key: item.key,
      title: item.title,
      description: item.description,
      images: localeSources
    };
  });

  const latestRefreshFromGit = copiedPaths.length
    ? runGit(rootDir, ["log", "-1", "--date=short", "--pretty=format:%ad", "--", ...copiedPaths])
    : "";
  const latestRefreshFromFs = copiedPaths.reduce((latest, filePath) => {
    const timestamp = existsSync(filePath) ? statSync(filePath).mtime.toISOString().slice(0, 10) : "";
    return timestamp > latest ? timestamp : latest;
  }, "");

  return {
    refreshedAt: latestRefreshFromGit || latestRefreshFromFs || "",
    items
  };
};
