import type {
  MarketplaceInstalledRecord,
  MarketplaceItemSummary,
  MarketplaceSceneView,
} from "@/shared/lib/api";
import type { InstallState } from "@/features/marketplace/components/marketplace-list-card";
import {
  buildLocaleFallbacks,
} from "@/features/marketplace/components/marketplace-localization";
import { MarketplaceListSkeleton } from "@/features/marketplace/components/marketplace-page-parts";
import { cn } from "@/shared/lib/utils";
import {
  ArrowLeft,
  Clock3,
  Compass,
} from "lucide-react";
import { type ComponentType } from "react";
import { SkillShelfCard } from "@/features/marketplace/components/curated-shelves/marketplace-shelf-card";
import {
  MARKETPLACE_SHELF_FALLBACK_VISUAL,
  MARKETPLACE_SHELF_SCENE_VISUALS,
  MARKETPLACE_SHELF_TONE_STYLES,
  type MarketplaceShelfLocalizedText,
  type MarketplaceShelfSceneVisual,
} from "@/features/marketplace/components/curated-shelves/marketplace-curated-shelves.config";

const SCENE_CARD_GRID_CLASS =
  "grid grid-cols-[repeat(auto-fill,minmax(240px,320px))] justify-start gap-3";
const SCENE_SKELETON_CARD_COUNT = 24;

export type MarketplaceShelfEntry = {
  item: MarketplaceItemSummary;
  record?: MarketplaceInstalledRecord;
};

export function MarketplaceCuratedShelves(props: {
  entries: MarketplaceShelfEntry[];
  scenes: MarketplaceSceneView[];
  language: string;
  installState: InstallState;
  onOpen: (entry: MarketplaceShelfEntry) => void;
  onInstall: (item: MarketplaceItemSummary) => void;
  onOpenScene: (scene: string) => void;
}) {
  const {
    entries,
    scenes,
    language,
    installState,
    onOpen,
    onInstall,
    onOpenScene,
  } = props;
  const localeFallbacks = buildLocaleFallbacks(language);
  const recentEntries = [...entries]
    .sort((left, right) => compareUpdatedAt(left.item, right.item))
    .slice(0, 6);

  return (
    <div className="mb-4 space-y-5">
      <section className="space-y-2.5">
        <ShelfHeader
          icon={Compass}
          title={readLocalized({ zh: "场景", en: "Scenes" }, language)}
          description={readLocalized(
            {
              zh: "按使用场景浏览适合的技能组合。",
              en: "Browse skills by how you plan to use them.",
            },
            language,
          )}
        />
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {scenes.map((scene) => (
            <GoalCard
              key={scene.scene}
              scene={scene}
              language={language}
              onSelect={onOpenScene}
            />
          ))}
        </div>
      </section>

      {recentEntries.length > 0 && (
        <ShelfItemRow
          icon={Clock3}
          title={readLocalized({ zh: "最近更新", en: "Recently updated" }, language)}
          description={readLocalized(
            {
              zh: "看看生态最近在补齐哪些能力。",
              en: "See what the ecosystem has been improving lately.",
            },
            language,
          )}
          entries={recentEntries}
          language={language}
          localeFallbacks={localeFallbacks}
          installState={installState}
          onOpen={onOpen}
          onInstall={onInstall}
        />
      )}
    </div>
  );
}

function GoalCard(props: {
  scene: MarketplaceSceneView;
  language: string;
  onSelect: (scene: string) => void;
}) {
  const { scene, language, onSelect } = props;
  const visual = resolveSceneVisual(scene.scene);
  const Icon = visual.icon;
  const tone = MARKETPLACE_SHELF_TONE_STYLES[visual.tone];

  return (
    <button
      type="button"
      onClick={() => onSelect(scene.scene)}
      className={cn(
        "group flex min-h-[74px] flex-col justify-center rounded-lg border px-3 py-2.5 text-left shadow-sm transition-colors hover:border-gray-300 hover:bg-gray-50/70",
        tone.card,
      )}
    >
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border",
              tone.icon,
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0 flex-1 truncate text-[13px] font-semibold text-gray-950">
            {readSceneTitle(scene, visual, language)}
          </div>
          {typeof scene.count === "number" && (
            <span className="shrink-0 text-[11px] font-medium text-gray-400">
              {readSceneCount(scene.count, language)}
            </span>
          )}
        </div>
        <p className={cn("mt-1 line-clamp-1 text-[11px] leading-relaxed", tone.text)}>
          {readSceneSummary(scene, visual, language)}
        </p>
      </div>
    </button>
  );
}

export function MarketplaceCuratedSceneView(props: {
  scene: MarketplaceSceneView;
  entries: MarketplaceShelfEntry[];
  isLoading: boolean;
  language: string;
  localeFallbacks: string[];
  installState: InstallState;
  onBack: () => void;
  onOpen: (entry: MarketplaceShelfEntry) => void;
  onInstall: (item: MarketplaceItemSummary) => void;
}) {
  const {
    scene,
    entries,
    isLoading,
    language,
    localeFallbacks,
    installState,
    onBack,
    onOpen,
    onInstall,
  } = props;
  const visual = resolveSceneVisual(scene.scene);
  const Icon = visual.icon;
  const tone = MARKETPLACE_SHELF_TONE_STYLES[visual.tone];

  return (
    <section className="flex min-h-full flex-col">
      <div className="mb-4 flex min-w-0 items-start gap-2.5">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
          aria-label={readLocalized({ zh: "返回", en: "Back" }, language)}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
                tone.icon,
              )}
            >
              <Icon className="h-4 w-4" />
            </span>
            <h3 className="min-w-0 flex-1 truncate text-[15px] font-semibold text-gray-950">
              {readSceneTitle(scene, visual, language)}
            </h3>
            <span className="shrink-0 text-[11px] font-medium text-gray-400">
              {readLocalized(
                isLoading
                  ? { zh: "加载中", en: "Loading" }
                  : { zh: `${entries.length} 个技能`, en: `${entries.length} skills` },
                language,
              )}
            </span>
          </div>
          <div className="mt-1.5 flex min-w-0 items-center gap-2">
            <p className="min-w-0 flex-1 truncate text-[12px] leading-relaxed text-gray-500">
              {readSceneSummary(scene, visual, language)}
            </p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div
          data-testid="marketplace-scene-skeleton"
          className={cn(
            SCENE_CARD_GRID_CLASS,
            "min-h-0 flex-1 auto-rows-[166px] content-start",
          )}
        >
          <MarketplaceListSkeleton count={SCENE_SKELETON_CARD_COUNT} />
        </div>
      ) : entries.length > 0 ? (
        <div className={SCENE_CARD_GRID_CLASS}>
          {entries.map((entry) => (
            <SkillShelfCard
              key={entry.item.id}
              entry={entry}
              language={language}
              localeFallbacks={localeFallbacks}
              installState={installState}
              layout="grid"
              onOpen={onOpen}
              onInstall={onInstall}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-gray-200 py-8 text-center text-[12px] text-gray-500">
          {readLocalized({ zh: "这个模块暂无技能。", en: "No skills in this module yet." }, language)}
        </div>
      )}
    </section>
  );
}

function ShelfItemRow(props: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  entries: MarketplaceShelfEntry[];
  language: string;
  localeFallbacks: string[];
  installState: InstallState;
  onOpen: (entry: MarketplaceShelfEntry) => void;
  onInstall: (item: MarketplaceItemSummary) => void;
}) {
  const {
    icon: Icon,
    title,
    description,
    entries,
    language,
    localeFallbacks,
    installState,
    onOpen,
    onInstall,
  } = props;

  return (
    <section className="space-y-2.5">
      <ShelfHeader icon={Icon} title={title} description={description} />
      <div className="-mx-1 flex gap-2.5 overflow-x-auto px-1 pb-1.5 custom-scrollbar">
        {entries.map((entry) => (
          <SkillShelfCard
            key={entry.item.id}
            entry={entry}
            language={language}
            localeFallbacks={localeFallbacks}
            installState={installState}
            onOpen={onOpen}
            onInstall={onInstall}
          />
        ))}
      </div>
    </section>
  );
}

function ShelfHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <h3 className="flex items-center gap-2 text-[14px] font-semibold text-gray-950">
          <Icon className="h-4 w-4 text-primary" />
          {title}
        </h3>
        <p className="mt-0.5 text-[12px] leading-relaxed text-gray-500">
          {description}
        </p>
      </div>
    </div>
  );
}

function compareUpdatedAt(left: MarketplaceItemSummary, right: MarketplaceItemSummary) {
  const leftTs = Date.parse(left.updatedAt);
  const rightTs = Date.parse(right.updatedAt);
  if (Number.isNaN(leftTs) || Number.isNaN(rightTs)) {
    return right.updatedAt.localeCompare(left.updatedAt);
  }
  return rightTs - leftTs;
}

function readLocalized(text: MarketplaceShelfLocalizedText, language: string) {
  return language.startsWith("zh") ? text.zh : text.en;
}

function resolveSceneVisual(scene: string): MarketplaceShelfSceneVisual {
  return MARKETPLACE_SHELF_SCENE_VISUALS.find((visual) => visual.scene === scene) ?? {
    scene,
    ...MARKETPLACE_SHELF_FALLBACK_VISUAL,
  };
}

function readSceneTitle(scene: MarketplaceSceneView, visual: MarketplaceShelfSceneVisual, language: string) {
  return visual.title ? readLocalized(visual.title, language) : scene.title;
}

function readSceneSummary(scene: MarketplaceSceneView, visual: MarketplaceShelfSceneVisual, language: string) {
  if (visual.summary) {
    return readLocalized(visual.summary, language);
  }
  return scene.description ?? scene.scene;
}

function readSceneCount(count: number, language: string) {
  return language.startsWith("zh") ? `${count} 个技能` : `${count} skills`;
}
