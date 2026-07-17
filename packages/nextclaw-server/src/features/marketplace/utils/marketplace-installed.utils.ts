import * as NextclawCore from "@nextclaw/core";
import { loadConfigOrDefault } from "@nextclaw-server/features/config/index.js";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type {
  MarketplaceInstalledRecord,
  MarketplaceInstalledView,
  MarketplaceItemView,
  MarketplaceListView
} from "@nextclaw-server/shared/types/server-api.types.js";
import { readNonEmptyString } from "@nextclaw-server/shared/utils/http-response.utils.js";
import type { SkillsLoaderConstructor, SkillsLoaderInstance, UiRouterOptions } from "@nextclaw-server/app/types/router-options.types.js";
import { MARKETPLACE_ZH_COPY_BY_SLUG } from "@nextclaw-server/features/marketplace/index.js";

const getWorkspacePathFromConfig = NextclawCore.getWorkspacePathFromConfig;
const MARKETPLACE_INSTALL_STATE_FILE = ".nextclaw-install.json";

function createSkillsLoader(workspace: string): SkillsLoaderInstance | null {
  const ctor = (NextclawCore as { SkillsLoader?: SkillsLoaderConstructor }).SkillsLoader;
  if (!ctor) {
    return null;
  }
  return new ctor(workspace);
}

export function collectInstalledSkillRecords(options: UiRouterOptions): {
  records: MarketplaceInstalledRecord[];
  specs: string[];
} {
  const config = loadConfigOrDefault(options.configPath);
  const workspacePath = getWorkspacePathFromConfig(config);
  const skillsLoader = createSkillsLoader(workspacePath);
  const availableSkillSet = new Set((skillsLoader?.listSkills(true) ?? []).map((skill) => skill.name));
  const listedSkills = skillsLoader?.listSkills(false) ?? [];

  const records = listedSkills
    .map((skill) => {
      const enabled = availableSkillSet.has(skill.name);
      const metadata = skillsLoader?.getSkillMetadata?.(skill);
      const description = readNonEmptyString(metadata?.description);
      const descriptionZh =
        readNonEmptyString(metadata?.description_zh) ??
        readNonEmptyString(metadata?.descriptionZh) ??
        readNonEmptyString(MARKETPLACE_ZH_COPY_BY_SLUG[skill.name]?.description);
      const marketplaceState = readMarketplaceSkillInstallState(dirname(skill.path));
      const origin = marketplaceState ? "marketplace" : undefined;
      const catalogSlug = marketplaceState?.slug;
      const installedAt = marketplaceState?.installedAt;
      return {
        type: "skill",
        id: skill.name,
        spec: skill.name,
        label: skill.name,
        description,
        descriptionZh,
        source: skill.source,
        origin,
        catalogSlug,
        installedAt,
        enabled,
        runtimeStatus: enabled ? "enabled" : "disabled"
      } satisfies MarketplaceInstalledRecord;
    })
    .sort((left, right) => left.spec.localeCompare(right.spec));

  return {
    specs: records.map((record) => record.spec),
    records
  };
}

function readMarketplaceSkillInstallState(destinationDir: string): {
  slug: string;
  installedAt?: string;
} | null {
  const statePath = join(destinationDir, MARKETPLACE_INSTALL_STATE_FILE);
  if (!existsSync(statePath)) {
    return null;
  }

  try {
    const parsed = JSON.parse(readFileSync(statePath, "utf8")) as {
      schemaVersion?: unknown;
      type?: unknown;
      source?: unknown;
      slug?: unknown;
      installedAt?: unknown;
    };
    if (
      parsed.schemaVersion !== 1
      || parsed.type !== "skill"
      || parsed.source !== "marketplace"
      || typeof parsed.slug !== "string"
    ) {
      return null;
    }

    return {
      slug: parsed.slug,
      installedAt: typeof parsed.installedAt === "string" ? parsed.installedAt : undefined
    };
  } catch {
    return null;
  }
}

export function collectSkillMarketplaceInstalledView(options: UiRouterOptions): MarketplaceInstalledView {
  const installed = collectInstalledSkillRecords(options);
  return {
    type: "skill",
    total: installed.records.length,
    specs: installed.specs,
    records: installed.records
  };
}

export function findUnsupportedSkillInstallKind(
  items: Array<MarketplaceItemView | MarketplaceListView["items"][number]>
): string | null {
  for (const item of items) {
    if (item.type !== "skill") {
      continue;
    }
    const kind = item.install.kind as string;
    if (kind !== "builtin" && kind !== "marketplace") {
      return kind;
    }
  }
  return null;
}
