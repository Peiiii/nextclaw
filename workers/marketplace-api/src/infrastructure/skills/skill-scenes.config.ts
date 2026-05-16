export type MarketplaceSceneView = {
  scene: string;
  title: string;
  description?: string;
  count?: number;
};

type SkillMarketplaceSceneConfig = Omit<MarketplaceSceneView, "count"> & { tags: string[] };
type SkillMarketplaceSceneSeed = readonly [scene: string, title: string, description: string, tags: string[]];

const SKILL_MARKETPLACE_SCENE_SEEDS: SkillMarketplaceSceneSeed[] = [
  ["development-debugging", "Development", "Review, debug, analyze, and verify delivery work.", ["code", "debug", "git", "review"]],
  ["office-collaboration", "Office Work", "Connect docs, calendars, meetings, mail, and teams.", ["lark", "document", "calendar", "mail"]],
  ["writing-content", "Writing", "Turn research, writing, polishing, and publishing into one flow.", ["writing", "content", "seo", "social"]],
  ["browser-automation", "Browser", "Operate pages, capture dynamic content, and verify user paths.", ["browser", "automation", "web"]],
  ["local-environment", "Local", "Manage shells, files, runtimes, and local services.", ["tmux", "shell", "files", "runtime"]],
  ["social-platforms", "Social", "Handle posting, interaction, search, and distribution.", ["social", "twitter", "media"]],
  ["nextclaw-official", "NextClaw Official", "Browse native capabilities from NextClaw.", ["nextclaw"]]
];

export const SKILL_MARKETPLACE_SCENES: SkillMarketplaceSceneConfig[] = SKILL_MARKETPLACE_SCENE_SEEDS.map(
  ([scene, title, description, tags]) => ({ scene, title, description, tags })
);

export function listSkillMarketplaceScenes(counts: ReadonlyMap<string, number>): MarketplaceSceneView[] {
  return SKILL_MARKETPLACE_SCENES.map(({ scene, title, description }) => ({
    scene,
    title,
    ...(description ? { description } : {}),
    count: counts.get(scene) ?? 0,
  }));
}

export function findSkillMarketplaceSceneTags(scene?: string): string[] | null {
  const normalizedScene = scene?.trim();
  if (!normalizedScene) {
    return null;
  }
  const sceneConfig = SKILL_MARKETPLACE_SCENES.find((entry) => entry.scene === normalizedScene);
  if (!sceneConfig) {
    return [];
  }
  return sceneConfig.tags;
}
