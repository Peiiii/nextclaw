import type {
  MarketplaceItemSummary,
  MarketplaceSceneView,
} from "@nextclaw-server/shared/types/server-api.types.js";

type SkillMarketplaceSceneConfig = MarketplaceSceneView & {
  tags: string[];
};

const SKILL_MARKETPLACE_SCENES: SkillMarketplaceSceneConfig[] = [
  {
    scene: "development-debugging",
    title: "Development",
    description: "Review, debug, analyze, and verify delivery work.",
    tags: ["code", "debug", "git", "review"],
  },
  {
    scene: "office-collaboration",
    title: "Office Work",
    description: "Connect docs, calendars, meetings, mail, and teams.",
    tags: ["lark", "document", "calendar", "mail"],
  },
  {
    scene: "writing-content",
    title: "Writing",
    description: "Turn research, writing, polishing, and publishing into one flow.",
    tags: ["writing", "content", "seo", "social"],
  },
  {
    scene: "browser-automation",
    title: "Browser",
    description: "Operate pages, capture dynamic content, and verify user paths.",
    tags: ["browser", "automation", "web"],
  },
  {
    scene: "local-environment",
    title: "Local",
    description: "Manage shells, files, runtimes, and local services.",
    tags: ["tmux", "shell", "files", "runtime"],
  },
  {
    scene: "social-platforms",
    title: "Social",
    description: "Handle posting, interaction, search, and distribution.",
    tags: ["social", "twitter", "media"],
  },
  {
    scene: "nextclaw-official",
    title: "NextClaw Official",
    description: "Browse native capabilities from NextClaw.",
    tags: ["nextclaw"],
  },
];

export function listSkillMarketplaceScenes(counts?: ReadonlyMap<string, number>): MarketplaceSceneView[] {
  return SKILL_MARKETPLACE_SCENES.map(({ scene, title, description }) => ({
    scene,
    title,
    ...(description ? { description } : {}),
    ...(counts?.has(scene) ? { count: counts.get(scene) } : {}),
  }));
}

export function countSkillMarketplaceScenes(items: MarketplaceItemSummary[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const scene of SKILL_MARKETPLACE_SCENES) {
    counts.set(scene.scene, items.filter((item) => matchesSkillMarketplaceScene(item, scene)).length);
  }
  return counts;
}

export function findSkillMarketplaceScene(scene?: string): SkillMarketplaceSceneConfig | undefined {
  const normalizedScene = scene?.trim();
  if (!normalizedScene) {
    return undefined;
  }
  return SKILL_MARKETPLACE_SCENES.find((entry) => entry.scene === normalizedScene);
}

export function matchesSkillMarketplaceScene(
  item: MarketplaceItemSummary,
  scene: SkillMarketplaceSceneConfig,
): boolean {
  const itemTags = new Set(item.tags.map((tag) => tag.trim().toLowerCase()));
  return scene.tags.some((tag) => itemTags.has(tag));
}
