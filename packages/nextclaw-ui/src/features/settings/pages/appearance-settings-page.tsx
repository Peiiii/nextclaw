import type { ChatMessageLayout } from "@nextclaw/agent-chat-ui";
import { Check, Palette } from "lucide-react";
import { PageHeader, PageLayout } from "@/app/components/layout/page-layout";
import { useChatMessageLayoutStore } from "@/features/chat";
import { SettingRow } from "@/shared/components/settings/setting-row";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Switch } from "@/shared/components/ui/switch";
import { useSideDockStore } from "@/features/side-dock";
import { t } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";

const CHAT_MESSAGE_LAYOUT_OPTIONS: Array<{
  value: ChatMessageLayout;
  labelKey: string;
  descriptionKey: string;
}> = [
  {
    value: "card",
    labelKey: "chatMessageLayoutCard",
    descriptionKey: "chatMessageLayoutCardDescription",
  },
  {
    value: "flat",
    labelKey: "chatMessageLayoutFlat",
    descriptionKey: "chatMessageLayoutFlatDescription",
  },
];

export function AppearanceSettingsPage() {
  const messageLayout = useChatMessageLayoutStore((state) => state.layout);
  const setMessageLayout = useChatMessageLayoutStore(
    (state) => state.setLayout,
  );
  const isSideDockVisible = useSideDockStore((state) => state.isVisible);
  const setSideDockVisible = useSideDockStore((state) => state.setVisible);

  return (
    <PageLayout>
      <PageHeader title={t("appearance")} />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            {t("appearance")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <SettingRow
            title={t("chatMessageLayoutTitle")}
            description={t("chatMessageLayoutDescription")}
          >
            <div
              role="radiogroup"
              aria-label={t("chatMessageLayoutTitle")}
              className="grid gap-2 sm:grid-cols-2"
            >
              {CHAT_MESSAGE_LAYOUT_OPTIONS.map((option) => {
                const selected = option.value === messageLayout;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setMessageLayout(option.value)}
                    className={cn(
                      "flex min-w-0 items-start gap-3 rounded-xl border px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35",
                      selected
                        ? "border-primary/35 bg-primary/5 text-foreground"
                        : "border-border bg-card text-muted-foreground hover:border-border/80 hover:bg-muted/45 hover:text-foreground",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background",
                      )}
                    >
                      {selected ? (
                        <Check className="h-2.5 w-2.5" strokeWidth={3} />
                      ) : null}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">
                        {t(option.labelKey)}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                        {t(option.descriptionKey)}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </SettingRow>
          <SettingRow
            title={t("sideDockVisibilityTitle")}
            description={t("sideDockVisibilityDescription")}
            control={
              <Switch
                id="appearance-side-dock-visible"
                aria-label={t("sideDockVisibilityTitle")}
                checked={isSideDockVisible}
                onCheckedChange={setSideDockVisible}
              />
            }
          />
        </CardContent>
      </Card>
    </PageLayout>
  );
}
