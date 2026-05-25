import * as NextclawCore from "@nextclaw/core";
import { loadConfigOrDefault } from "@nextclaw-server/features/config/index.js";
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
      return {
        type: "skill",
        id: skill.name,
        spec: skill.name,
        label: skill.name,
        ...(description ? { description } : {}),
        ...(descriptionZh ? { descriptionZh } : {}),
        source: skill.source,
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

export function collectSkillMarketplaceInstalledView(options: UiRouterOptions): MarketplaceInstalledView {
  const installed = collectInstalledSkillRecords(options);
  return {
    type: "skill",
    total: installed.records.length,
    specs: installed.specs,
    records: installed.records
  };
}

export function collectKnownSkillNames(options: UiRouterOptions): Set<string> {
  const config = loadConfigOrDefault(options.configPath);
  const loader = createSkillsLoader(getWorkspacePathFromConfig(config));
  return new Set((loader?.listSkills(false) ?? []).map((skill) => skill.name));
}

export function isSupportedMarketplaceSkillItem(
  item: MarketplaceItemView | MarketplaceListView["items"][number],
  knownSkillNames: Set<string>
): boolean {
  if (item.type !== "skill") {
    return false;
  }

  if (item.install.kind === "marketplace") {
    return true;
  }

  return item.install.kind === "builtin" && knownSkillNames.has(item.install.spec);
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
