import { useLocation } from "react-router-dom";
import { PageResourceActionsMenu } from "./page-resource-actions-menu";
import { resolveUiDocumentTitle } from "@/shared/lib/ui-document-title";
import {
  getMainSidebarNavItems,
  getSettingsNavItems,
} from "@/app/configs/app-navigation.config";
import { t } from "@/shared/lib/i18n";

/** Route pages share resource actions; forms retain their main-workspace-only capability. */
export function CurrentPageActions() {
  const { pathname } = useLocation();
  const navigation = [...getMainSidebarNavItems(t), ...getSettingsNavItems(t)];
  const title =
    navigation.find((item) => item.target === pathname)?.label ??
    resolveUiDocumentTitle(pathname).replace(/^NextClaw - /, "");
  const uri = `nextclaw://page?${new URLSearchParams({ path: pathname })}`;
  return (
    <div className="flex shrink-0 justify-end border-b border-border/40 px-3 py-1">
      <PageResourceActionsMenu
        page={{
          uri,
          title,
          mainPath: pathname,
          target: {
            kind: "route",
            title,
            url: pathname,
            resourceUri: uri,
            historyPolicy: "none",
          },
        }}
      />
    </div>
  );
}
