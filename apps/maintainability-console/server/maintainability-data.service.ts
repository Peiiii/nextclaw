import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type {
  BreakdownMetricRow,
  DirectoryBudgetHotspot,
  FileMetricRow,
  MaintainabilityHotspotRow,
  MaintainabilityOverview,
  MaintainabilityProfile,
  MetricTotals
} from "../shared/maintainability.types.js";

type SnapshotMetricRow = MetricTotals & {
  name: string;
};

type SnapshotFileRow = MetricTotals & {
  path: string;
  scope: string;
  language: string;
};

type SnapshotResult = {
  generatedAt: string;
  scope: {
    profile: MaintainabilityProfile;
    includePaths: string[];
    includeExtensions: string[];
    excludeDirs: string[];
  };
  totals: MetricTotals;
  byLanguage: SnapshotMetricRow[];
  byScope: SnapshotMetricRow[];
  byFile: SnapshotFileRow[];
};

type DirectoryBudgetResult = {
  hotspots: Array<{
    level: "warn" | "error";
    path: string;
    message: string;
    budget: string;
    current_count: number;
    previous_count: number | null;
    delta_count: number | null;
    exception_path: string | null;
    exception_reason: string | null;
    exception_status: "complete" | "incomplete" | "missing";
  }>;
};

type HotspotSourceRow = {
  chain: string;
  path: string;
  rationale: string;
  nextSplitSeam: string;
  allowedAdditions: string[];
  prohibitedAdditions: string[];
};

type BaseScanConfig = {
  includePaths: string[];
  includeExtensions: string[];
  excludeDirs: string[];
};

type MetricsModuleBundle = {
  createBaseScanConfig: (params: {
    repoRoot: string;
    scopeProfile: MaintainabilityProfile;
  }) => BaseScanConfig;
  collectDetailedSnapshot: (params: {
    repoRoot: string;
    scopeProfile: MaintainabilityProfile;
    includePaths: string[];
    includeExtensions: string[];
    excludeDirs: string[];
    gitSha: string | null;
    gitRef: string | null;
    generatedAt: string;
  }) => SnapshotResult;
  collectDirectoryBudgetHotspots: (params: {
    rootDir: string;
    scanRoots: string[];
  }) => DirectoryBudgetResult;
  hotspots: HotspotSourceRow[];
};

const VALID_PROFILES = new Set<MaintainabilityProfile>(["source", "repo-volume"]);

function createBreakdownRows(rows: SnapshotMetricRow[], totalCodeLines: number): BreakdownMetricRow[] {
  return rows.map((row) => ({
    ...row,
    sharePercent: totalCodeLines > 0 ? (row.codeLines / totalCodeLines) * 100 : 0,
    averageCodeLinesPerFile: row.files > 0 ? row.codeLines / row.files : 0
  }));
}

function createLargestFileRows(rows: SnapshotFileRow[], totalCodeLines: number): FileMetricRow[] {
  return rows.slice(0, 18).map((row) => ({
    ...row,
    sharePercent: totalCodeLines > 0 ? (row.codeLines / totalCodeLines) * 100 : 0
  }));
}

function countFileLines(filePath: string): number | null {
  if (!existsSync(filePath)) {
    return null;
  }
  return readFileSync(filePath, "utf8").split(/\r?\n/).length;
}

export class MaintainabilityDataService {
  readonly appRoot: string;
  readonly repoRoot: string;
  moduleBundlePromise: Promise<MetricsModuleBundle> | null = null;

  constructor(appRoot = process.cwd()) {
    this.appRoot = appRoot;
    this.repoRoot = resolve(appRoot, "../..");
  }

  assertProfile = (profileText: string | null | undefined): MaintainabilityProfile => {
    const normalized = `${profileText ?? "source"}`.trim() || "source";
    if (VALID_PROFILES.has(normalized as MaintainabilityProfile)) {
      return normalized as MaintainabilityProfile;
    }
    throw new Error(`Unsupported maintainability profile: ${normalized}`);
  };

  getOverview = async (profile: MaintainabilityProfile): Promise<MaintainabilityOverview> => {
    const startedAt = performance.now();
    const modules = await this.loadModules();
    const generatedAt = new Date().toISOString();
    const git = this.readGitMetadata();

    const baseConfig = modules.createBaseScanConfig({
      repoRoot: this.repoRoot,
      scopeProfile: profile
    });
    const snapshot = modules.collectDetailedSnapshot({
      repoRoot: this.repoRoot,
      scopeProfile: profile,
      includePaths: baseConfig.includePaths,
      includeExtensions: baseConfig.includeExtensions,
      excludeDirs: baseConfig.excludeDirs,
      gitSha: git.sha,
      gitRef: git.ref,
      generatedAt
    });

    const repoVolumeConfig = modules.createBaseScanConfig({
      repoRoot: this.repoRoot,
      scopeProfile: "repo-volume"
    });
    const directoryBudget = modules.collectDirectoryBudgetHotspots({
      rootDir: this.repoRoot,
      scanRoots: repoVolumeConfig.includePaths
    });
    const fileMetricsByPath = new Map(snapshot.byFile.map((entry) => [entry.path, entry]));
    const maintainabilityHotspots = modules.hotspots.map<MaintainabilityHotspotRow>((entry) => {
      const snapshotFile = fileMetricsByPath.get(entry.path);
      return {
        chain: entry.chain,
        path: entry.path,
        rationale: entry.rationale,
        nextSplitSeam: entry.nextSplitSeam,
        allowedAdditions: entry.allowedAdditions,
        prohibitedAdditions: entry.prohibitedAdditions,
        currentLines: snapshotFile?.totalLines ?? countFileLines(resolve(this.repoRoot, entry.path)),
        codeLines: snapshotFile?.codeLines ?? null,
        scope: snapshotFile?.scope ?? null
      };
    }).sort((left, right) => {
      const leftScore = left.codeLines ?? left.currentLines ?? -1;
      const rightScore = right.codeLines ?? right.currentLines ?? -1;
      if (rightScore !== leftScore) {
        return rightScore - leftScore;
      }
      return left.path.localeCompare(right.path);
    });

    return {
      generatedAt,
      durationMs: Math.round(performance.now() - startedAt),
      repoRoot: this.repoRoot,
      profile,
      git,
      summary: {
        moduleCount: snapshot.byScope.length,
        languageCount: snapshot.byLanguage.length,
        directoryHotspotCount: directoryBudget.hotspots.length,
        maintainabilityHotspotCount: maintainabilityHotspots.length,
        scanRootCount: snapshot.scope.includePaths.length
      },
      scope: {
        includePaths: snapshot.scope.includePaths,
        includeExtensions: snapshot.scope.includeExtensions,
        excludeDirs: snapshot.scope.excludeDirs
      },
      totals: snapshot.totals,
      byScope: createBreakdownRows(snapshot.byScope, snapshot.totals.codeLines),
      byLanguage: createBreakdownRows(snapshot.byLanguage, snapshot.totals.codeLines),
      largestFiles: createLargestFileRows(snapshot.byFile, snapshot.totals.codeLines),
      directoryHotspots: directoryBudget.hotspots.map<DirectoryBudgetHotspot>((entry) => ({
        level: entry.level,
        path: entry.path,
        message: entry.message,
        budget: entry.budget,
        currentCount: entry.current_count,
        previousCount: entry.previous_count,
        deltaCount: entry.delta_count,
        exceptionPath: entry.exception_path,
        exceptionReason: entry.exception_reason,
        exceptionStatus: entry.exception_status
      })),
      maintainabilityHotspots
    };
  };

  loadModules = async (): Promise<MetricsModuleBundle> => {
    if (!this.moduleBundlePromise) {
      this.moduleBundlePromise = (async () => {
        const [
          profileModule,
          snapshotModule,
          directoryBudgetModule,
          hotspotModule
        ] = await Promise.all([
          import(pathToFileURL(resolve(this.repoRoot, "scripts/code-volume-metrics-profile.mjs")).href),
          import(pathToFileURL(resolve(this.repoRoot, "scripts/code-volume-metrics-snapshot.mjs")).href),
          import(pathToFileURL(resolve(this.repoRoot, "scripts/maintainability-directory-budget.mjs")).href),
          import(pathToFileURL(resolve(this.repoRoot, "scripts/maintainability-hotspots.mjs")).href)
        ]);

        return {
          createBaseScanConfig: profileModule.createBaseScanConfig as MetricsModuleBundle["createBaseScanConfig"],
          collectDetailedSnapshot: snapshotModule.collectDetailedSnapshot as MetricsModuleBundle["collectDetailedSnapshot"],
          collectDirectoryBudgetHotspots:
            directoryBudgetModule.collectDirectoryBudgetHotspots as MetricsModuleBundle["collectDirectoryBudgetHotspots"],
          hotspots: hotspotModule.MAINTAINABILITY_HOTSPOTS as HotspotSourceRow[]
        };
      })();
    }

    return this.moduleBundlePromise;
  };

  readGitMetadata = (): { sha: string | null; ref: string | null } => {
    try {
      return {
        sha: execFileSync("git", ["rev-parse", "HEAD"], {
          cwd: this.repoRoot,
          encoding: "utf8"
        }).trim(),
        ref: execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
          cwd: this.repoRoot,
          encoding: "utf8"
        }).trim()
      };
    } catch {
      return {
        sha: null,
        ref: null
      };
    }
  };
}
