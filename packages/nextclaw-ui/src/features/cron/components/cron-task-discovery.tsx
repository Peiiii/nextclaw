import { forwardRef, type FormEvent } from "react";
import {
  ArrowUp,
  BookOpen,
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  Heart,
  Lightbulb,
  Newspaper,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { t } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";

type CronTemplate = {
  readonly descriptionKey: string;
  readonly icon: LucideIcon;
  readonly promptKey: string;
  readonly titleKey: string;
};

const CRON_TEMPLATES: readonly CronTemplate[] = [
  {
    titleKey: "cronTemplateAiNewsTitle",
    descriptionKey: "cronTemplateAiNewsDescription",
    promptKey: "cronTemplateAiNewsPrompt",
    icon: Newspaper,
  },
  {
    titleKey: "cronTemplateWeeklyReviewTitle",
    descriptionKey: "cronTemplateWeeklyReviewDescription",
    promptKey: "cronTemplateWeeklyReviewPrompt",
    icon: ChartNoAxesColumnIncreasing,
  },
  {
    titleKey: "cronTemplateMeetingPrepTitle",
    descriptionKey: "cronTemplateMeetingPrepDescription",
    promptKey: "cronTemplateMeetingPrepPrompt",
    icon: CalendarDays,
  },
  {
    titleKey: "cronTemplateLearningTitle",
    descriptionKey: "cronTemplateLearningDescription",
    promptKey: "cronTemplateLearningPrompt",
    icon: BookOpen,
  },
  {
    titleKey: "cronTemplateCompetitorTitle",
    descriptionKey: "cronTemplateCompetitorDescription",
    promptKey: "cronTemplateCompetitorPrompt",
    icon: Lightbulb,
  },
  {
    titleKey: "cronTemplateFamilyTitle",
    descriptionKey: "cronTemplateFamilyDescription",
    promptKey: "cronTemplateFamilyPrompt",
    icon: Heart,
  },
];

type CronTaskComposerProps = {
  readonly prominent?: boolean;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onSubmit: () => void;
};

export const CronTaskComposer = forwardRef<
  HTMLInputElement,
  CronTaskComposerProps
>(function CronTaskComposer(
  { prominent = false, value, onChange, onSubmit },
  ref,
) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <form
      className={cn("relative w-full", prominent && "mx-auto max-w-3xl")}
      onSubmit={handleSubmit}
    >
      <Sparkles
        className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/70"
        aria-hidden="true"
      />
      <Input
        ref={ref}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="pl-9 pr-11 focus:border-border/75"
        placeholder={t("cronComposerPlaceholder")}
        aria-label={t("cronComposerLabel")}
      />
      <Button
        type="submit"
        size="icon"
        className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 rounded-full shadow-none"
        disabled={!value.trim()}
        aria-label={t("cronComposerSubmit")}
      >
        <ArrowUp className="h-4 w-4" />
      </Button>
    </form>
  );
});

type CronTemplateGalleryProps = {
  readonly compact?: boolean;
  readonly onSelect: (prompt: string) => void;
};

export function CronTemplateGallery({
  compact = false,
  onSelect,
}: CronTemplateGalleryProps) {
  const templates = compact ? CRON_TEMPLATES.slice(0, 4) : CRON_TEMPLATES;

  return (
    <div
      className={cn(
        "grid gap-3 sm:grid-cols-2",
        compact ? "xl:grid-cols-4" : "lg:grid-cols-3",
      )}
    >
      {templates.map((template) => {
        const Icon = template.icon;
        return (
          <button
            key={template.titleKey}
            type="button"
            onClick={() => onSelect(t(template.promptKey))}
            className="group grid min-h-24 grid-cols-[38px_minmax(0,1fr)] items-center gap-3 rounded-2xl border border-border/60 bg-card px-4 py-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-[0_12px_30px_rgba(30,45,52,0.08)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <strong className="block text-sm font-medium text-foreground">
                {t(template.titleKey)}
              </strong>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                {t(template.descriptionKey)}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
