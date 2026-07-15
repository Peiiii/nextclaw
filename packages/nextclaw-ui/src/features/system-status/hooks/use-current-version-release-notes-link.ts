import { useQuery } from '@tanstack/react-query';
import { getLanguage } from '@/shared/lib/i18n';
import {
  fetchReleaseNotesData,
  resolveReleaseNotesHtmlUrl,
  resolveVersionReleaseNotesDataUrl,
  type ReleaseNotesLink,
  type ReleaseNotesLocale
} from '@/features/system-status/utils/update-release-notes.utils';

function getReleaseNotesLocale(): ReleaseNotesLocale {
  return getLanguage() === 'zh' ? 'zh-CN' : 'en-US';
}

export function useCurrentVersionReleaseNotesLink(productVersion: string | undefined): ReleaseNotesLink | null {
  const dataUrl = resolveVersionReleaseNotesDataUrl(productVersion);
  const locale = getReleaseNotesLocale();
  const releaseNotesQuery = useQuery({
    queryKey: ['current-release-notes', dataUrl],
    queryFn: async () => await fetchReleaseNotesData(dataUrl ?? ''),
    enabled: Boolean(dataUrl),
    retry: false,
    staleTime: 5 * 60 * 1000
  });
  const url = resolveReleaseNotesHtmlUrl(releaseNotesQuery.data, locale);
  const version = productVersion?.trim();
  return url && version
    ? {
        url,
        versionLabel: `v${version}`
      }
    : null;
}
