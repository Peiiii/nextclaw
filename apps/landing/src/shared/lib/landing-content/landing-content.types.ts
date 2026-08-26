import type { DownloadAssetKey } from '@/shared/lib/desktop-release';

export type Locale = 'en' | 'zh';
export type PageRoute = 'home' | 'download' | 'useCases' | 'integrations' | 'releases';

export type FeatureItem = {
  icon: string;
  title: string;
  description: string;
};

export type ShowcaseItem = {
  eyebrow: string;
  title: string;
  description: string;
  imageSrc: string;
  imageAlt: string;
};

export type RuntimeShowcase = Omit<ShowcaseItem, 'eyebrow'> & {
  agentLabel: string;
  agentDescription: string;
  runtimeLabel: string;
  runtimeDescription: string;
  runtimeNames: string[];
};

export type ProactiveDeliveryShowcase = {
  eyebrow: string;
  title: string;
  description: string;
  inboxLabel: string;
  inboxTitle: string;
  notificationLabel: string;
  notificationTitle: string;
  guideLabel: string;
  inboxImageSrc: string;
  inboxImageAlt: string;
  notificationImageSrc: string;
  notificationImageAlt: string;
};

export type EcosystemItem = {
  label: string;
  logo?: string;
};

export type EcosystemGroup = {
  icon: string;
  title: string;
  description: string;
  items: EcosystemItem[];
};

export type FAQItem = {
  question: string;
  answer: string;
};

export type ReleaseNote = {
  category: string;
  title: string;
  description: string;
  items: string[];
};

export type DownloadOption = {
  key: DownloadAssetKey;
  icon: string;
  title: string;
  description: string;
  buttonLabel: string;
};

export type InstallMethod = {
  key: 'npm' | 'docker';
  icon: string;
  title: string;
  description: string;
  buttonLabel: string;
  command?: string;
  docsPath?: string;
};

export type ComparisonValue = {
  icon: string;
  title: string;
  description: string;
  linkLabel: string;
  href: string;
};

export type ComparisonCopy = {
  title: string;
  subtitle: string;
  values: ComparisonValue[];
};

export type LandingCopy = {
  navDownload: string;
  navUseCases: string;
  navCompare: string;
  navIntegrations: string;
  navCommunity: string;
  navDocs: string;
  heroTitleLine1: string;
  heroDescription: string;
  heroDownloadButton: string;
  heroSecondaryButton: string;
  heroInstallLink: string;
  heroInstallDescription: string;
  heroScreenshotAlt: string;
  downloadTitle: string;
  downloadSubtitle: string;
  downloadDesktopTitle: string;
  downloadDesktopSubtitle: string;
  downloadVersionLabel: string;
  downloadDetectedLabel: string;
  downloadUnknownPlatform: string;
  downloadReleaseLabel: string;
  downloadReleaseLinkText: string;
  downloadUnsignedNotice: string;
  downloadOpenGuideTitle: string;
  downloadMacGuideTitle: string;
  downloadWindowsGuideTitle: string;
  downloadLinuxGuideTitle: string;
  downloadMacGuideSteps: string[];
  downloadWindowsGuideSteps: string[];
  downloadLinuxGuideSteps: string[];
  downloadWindowsPortableLabel: string;
  downloadWindowsPortableDescription: string;
  downloadOptions: DownloadOption[];
  installCopyLabel: string;
  installCopiedText: string;
  installMethods: InstallMethod[];
  docsButton: string;
  screenshotChatSrc: string;
  showcaseTitle: string;
  showcaseSubtitle: string;
  showcaseItems: ShowcaseItem[];
  runtimeShowcase: RuntimeShowcase;
  appSurfaceTitle: string;
  appSurfaceSubtitle: string;
  appSurfaceItems: ShowcaseItem[];
  ecosystemTitle: string;
  ecosystemSubtitle: string;
  integrationsTitle: string;
  integrationsSubtitle: string;
  integrationsDocsButton: string;
  integrationsInstallButton: string;
  integrationShowcaseItems: ShowcaseItem[];
  ecosystemGroups: EcosystemGroup[];
  useCasesTitle: string;
  useCasesSubtitle: string;
  useCasesPageTitle: string;
  useCasesPageSubtitle: string;
  useCasesCtaTitle: string;
  useCasesCtaDescription: string;
  useCases: FeatureItem[];
  comparison: ComparisonCopy;
  releasesTitle: string;
  releasesSubtitle: string;
  releasesGitHubButton: string;
  releasesDownloadButton: string;
  releaseNotes: ReleaseNote[];
  featuresTitle: string;
  featuresSubtitle: string;
  features: FeatureItem[];
  ctaTitle: string;
  ctaDescription: string;
  ctaButton: string;
  footerProject: string;
  footerLicense: string;
  footerDocs: string;
  footerReleases: string;
  footerNpm: string;
  footerWechatGroup: string;
  communityTitle: string;
  communitySubtitle: string;
  communityWechatLabel: string;
  communityScanHint: string;
  faqTitle: string;
  faqSubtitle: string;
  faq: FAQItem[];
};
