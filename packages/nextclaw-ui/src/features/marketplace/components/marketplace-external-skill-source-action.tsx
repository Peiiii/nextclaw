import { NavigationLink } from "@/shared/components/actions/navigation-link";
import { t } from "@/shared/lib/i18n";

const SKILLHUB_URL = "https://skillhub.cn/";

export function MarketplaceExternalSkillSourceAction() {
  return (
    <NavigationLink
      href={SKILLHUB_URL}
      external
      className="h-7 shrink-0 px-1.5 text-[13px]"
    >
      {t("marketplaceExternalSkillSourceTitle")}
    </NavigationLink>
  );
}
