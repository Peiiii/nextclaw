import { ExternalActionLink } from "@/shared/components/actions/action-link";
import { hostCapabilityManager } from "@/shared/lib/host-capabilities";
import { t } from "@/shared/lib/i18n";

const SKILLHUB_URL = "https://skillhub.cn/";

export function MarketplaceExternalSkillSourceAction() {
  return (
    <ExternalActionLink
      label={t("marketplaceExternalSkillSourceTitle")}
      onClick={() => void hostCapabilityManager.openExternalUrl(SKILLHUB_URL)}
    />
  );
}
