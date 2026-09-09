import './style.css';
import './runtime-showcase.css';
import { createIcons, icons } from 'lucide';
import { LANDING_EN_COPY } from '@/shared/lib/landing-content/landing-copy-en.config';
import { LANDING_ZH_COPY } from '@/shared/lib/landing-content/landing-copy-zh.config';
import { bindInteractiveArtifactMedia } from '@/shared/lib/landing-content/utils/interactive-artifact.utils';
import {
  DESKTOP_RELEASE_FALLBACK,
  detectRecommendedDesktopAsset,
  fetchLatestStableDesktopRelease,
  type DesktopReleaseInfo,
  type DownloadAssetKey
} from '@/shared/lib/desktop-release';
import {
  isLocale,
  LINKS,
  LOCALE_OPTIONS,
  persistLocale,
  renderHomeSections,
  renderIntegrationsPage,
  renderLandingHomeHero,
  renderLandingRouteHero,
  renderLandingFooter,
  renderReleasesPage,
  renderUseCasesPage,
  resolvePageLocale,
  resolvePageRoute,
  ROUTES,
  type DownloadOption,
  type InstallMethod,
  type LandingCopy,
  type Locale,
  type PageRoute
} from '@/shared/lib/landing-content';

declare global {
  interface Window {
    __NEXTCLAW_LOCALE__?: string;
    __NEXTCLAW_ROUTE__?: string;
  }
}

const COPY: Record<Locale, LandingCopy> = { en: LANDING_EN_COPY, zh: LANDING_ZH_COPY };

class LandingPage {
  private readonly root: HTMLDivElement;
  private readonly locale: Locale;
  private readonly route: PageRoute;
  private readonly copy: LandingCopy;
  private mediaObserver?: IntersectionObserver;

  constructor(root: HTMLDivElement, locale: Locale, route: PageRoute) {
    this.root = root;
    this.locale = locale;
    this.route = route;
    this.copy = COPY[locale];
  }

  private renderDownloadCard = (option: DownloadOption): string => `
    <article data-download-card="${option.key}" class="rounded-2xl border border-border/70 bg-background/70 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div class="flex items-start gap-3">
          <div class="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <i data-lucide="${option.icon}" class="w-5 h-5"></i>
          </div>
          <div>
            <h3 class="font-semibold text-lg">${option.title}</h3>
            <p class="text-sm text-muted-foreground mt-1">${option.description}</p>
          </div>
        </div>
        <a
          data-download-link="${option.key}"
          href="#"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex h-11 min-w-[128px] shrink-0 items-center justify-center whitespace-nowrap rounded-xl border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
        >
          ${option.buttonLabel}
        </a>
      </div>
      ${option.key === 'windowsX64Installer'
        ? `<div class="mt-3 border-t border-border/50 pt-3 text-sm text-muted-foreground">
            <span>${this.copy.downloadWindowsPortableLabel}</span>
            <a
              id="desktop-windows-portable-link"
              href="${DESKTOP_RELEASE_FALLBACK.windowsPortableZipUrl ?? DESKTOP_RELEASE_FALLBACK.url}"
              target="_blank"
              rel="noopener noreferrer"
              class="ml-2 font-semibold text-primary hover:underline"
            >
              ${this.copy.downloadWindowsPortableDescription}
            </a>
          </div>`
        : ''}
    </article>
      `;

  private getInstallMethodHref = (method: InstallMethod, docsLink: string): string =>
    method.docsPath ? `${docsLink}${method.docsPath}` : LINKS.npm;

  private renderInstallMethodCard = (method: InstallMethod, docsLink: string): string => {
    const href = this.getInstallMethodHref(method, docsLink);

    return `
      <article id="install-${method.key}" data-install-method-card class="install-method-panel scroll-mt-28">
        <div class="install-method-panel__header">
          <div class="install-method-panel__icon">
            <i data-lucide="${method.icon}" class="h-5 w-5"></i>
          </div>
          <div>
            <h2 class="install-method-panel__title">${method.title}</h2>
            <p class="install-method-panel__description">${method.description}</p>
          </div>
        </div>
        ${method.command
          ? `<pre class="install-method-panel__command"><code class="font-mono text-foreground">${method.command}</code></pre>`
          : ''}
        <div class="install-method-panel__actions">
          ${method.command
            ? `<button data-install-copy-button type="button" class="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-background px-3 text-sm font-semibold text-foreground hover:bg-secondary transition-colors">
                ${this.copy.installCopyLabel}
              </button>`
            : ''}
          <a href="${href}" target="_blank" rel="noopener noreferrer" class="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
            ${method.buttonLabel}
            <i data-lucide="external-link" class="h-4 w-4"></i>
          </a>
        </div>
      </article>
    `;
  };

  private renderInstallMethodNav = (): string => {
    const methods = [
      { key: 'desktop', icon: 'monitor', title: this.copy.downloadDesktopTitle },
      ...this.copy.installMethods
    ];

    return `
      <nav class="install-method-nav" aria-label="${this.copy.navDownload}">
        ${methods.map((method, index) => `
          <a
            href="#install-${method.key}"
            data-install-method-link="install-${method.key}"
            class="install-method-nav__item${index === 0 ? ' is-recommended' : ''}"
            ${index === 0 ? 'aria-current="true"' : ''}
          >
            <i data-lucide="${method.icon}" class="h-4 w-4"></i>
            <span>${method.title}</span>
          </a>
        `).join('')}
      </nav>
    `;
  };

  render = (): void => {
    this.mediaObserver?.disconnect();
    const docsLink = LINKS.docs[this.locale];
    const homeRoute = ROUTES[this.locale].home;
    const downloadRoute = ROUTES[this.locale].download;
    const useCasesRoute = ROUTES[this.locale].useCases;
    const integrationsRoute = ROUTES[this.locale].integrations;
    const releasesRoute = ROUTES[this.locale].releases;
    const comparisonRoute = `${homeRoute}#compare`;
    const communityRoute = `${homeRoute}#community`;

    this.root.innerHTML = `
      <div class="landing-site relative min-h-screen flex flex-col bg-background">
        <header class="landing-header fixed z-50 glass border-b transition-all duration-300">
          <div class="landing-header__inner container mx-auto px-6 h-16 flex items-center justify-between">
            <a id="home-link" href="${homeRoute}" class="flex items-center gap-2 group cursor-pointer">
              <img src="/logo-phoenix.svg" alt="NextClaw" class="w-8 h-8 transition-transform group-hover:scale-105" />
              <span class="font-semibold text-lg tracking-normal">NextClaw</span>
            </a>
            <nav class="hidden md:flex gap-6 text-sm font-medium">
              <a href="${downloadRoute}" class="text-muted-foreground hover:text-foreground transition-colors">${this.copy.navDownload}</a>
              <a href="${useCasesRoute}" class="text-muted-foreground hover:text-foreground transition-colors">${this.copy.navUseCases}</a>
              <a href="${comparisonRoute}" class="text-muted-foreground hover:text-foreground transition-colors">${this.copy.navCompare}</a>
              <a href="${integrationsRoute}" class="text-muted-foreground hover:text-foreground transition-colors">${this.copy.navIntegrations}</a>
              <a href="${communityRoute}" class="text-muted-foreground hover:text-foreground transition-colors">${this.copy.navCommunity}</a>
              <a href="${docsLink}" target="_blank" rel="noopener noreferrer" class="text-muted-foreground hover:text-foreground transition-colors">${this.copy.navDocs}</a>
            </nav>
            <div class="flex items-center gap-2">
              <div class="relative flex items-center text-sm">
                <i data-lucide="languages" class="w-4 h-4 text-muted-foreground absolute left-0 top-1/2 -translate-y-1/2 pointer-events-none"></i>
                <select
                  id="locale-select"
                  class="h-8 pl-6 pr-4 bg-transparent border-0 text-muted-foreground hover:text-foreground transition-colors focus:outline-none appearance-none cursor-pointer"
                  aria-label="Select language"
                >
                  ${LOCALE_OPTIONS.map((option) => `<option value="${option.value}" ${option.value === this.locale ? 'selected' : ''}>${option.label}</option>`).join('')}
                </select>
                <i data-lucide="chevron-down" class="w-3 h-3 text-muted-foreground absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none"></i>
              </div>
              <a href="${LINKS.github}" target="_blank" rel="noopener noreferrer" class="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-full hover:bg-secondary" aria-label="GitHub">
                <i data-lucide="github" class="w-5 h-5"></i>
              </a>
              <button id="mobile-menu-btn" class="md:hidden p-2 text-muted-foreground hover:text-foreground transition-colors rounded-full hover:bg-secondary" aria-label="Menu">
                <i data-lucide="menu" class="w-5 h-5"></i>
              </button>
            </div>
          </div>
          <!-- Mobile menu -->
          <div id="mobile-menu" class="hidden md:hidden border-t border-border/40 bg-background/95 backdrop-blur-sm">
            <nav class="container mx-auto px-6 py-4 flex flex-col gap-4 text-sm font-medium">
              <a href="${downloadRoute}" class="text-muted-foreground hover:text-foreground transition-colors py-2">${this.copy.navDownload}</a>
              <a href="${useCasesRoute}" class="text-muted-foreground hover:text-foreground transition-colors py-2">${this.copy.navUseCases}</a>
              <a href="${comparisonRoute}" class="text-muted-foreground hover:text-foreground transition-colors py-2">${this.copy.navCompare}</a>
              <a href="${integrationsRoute}" class="text-muted-foreground hover:text-foreground transition-colors py-2">${this.copy.navIntegrations}</a>
              <a href="${communityRoute}" class="text-muted-foreground hover:text-foreground transition-colors py-2">${this.copy.navCommunity}</a>
              <a href="${docsLink}" target="_blank" rel="noopener noreferrer" class="text-muted-foreground hover:text-foreground transition-colors py-2">${this.copy.navDocs}</a>
            </nav>
          </div>
        </header>

        <main class="landing-main ${this.route === 'home'
          ? 'landing-main--home relative flex flex-col text-left z-10'
          : 'landing-main--route flex-1 flex flex-col items-center text-center px-6 pt-32 pb-20 z-10'}">
          <div class="${this.route === 'home' ? 'landing-home-shell relative z-10 w-full mx-auto' : 'contents'}">
          ${this.route === 'home' ? `
          ${renderLandingHomeHero(this.copy, downloadRoute, useCasesRoute)}
          ` : `
          ${renderLandingRouteHero(this.route, this.copy)}
          `}

          ${this.route === 'download' ? `
          <section id="install-methods" class="install-method-layout w-full max-w-6xl mx-auto mb-10 text-left animate-slide-up opacity-0 scroll-mt-28" style="animation-delay: 0.35s">
            ${this.renderInstallMethodNav()}
            <div class="install-method-panels">
              <section id="install-desktop" class="install-method-panel install-method-panel--desktop scroll-mt-28">
                <div class="install-method-panel__header install-method-panel__header--desktop">
                  <div class="flex items-start gap-3">
                    <div class="install-method-panel__icon">
                      <i data-lucide="monitor" class="h-5 w-5"></i>
                    </div>
                    <div>
                      <h2 class="install-method-panel__title">${this.copy.downloadDesktopTitle}</h2>
                      <p class="install-method-panel__description">${this.copy.downloadDesktopSubtitle}</p>
                    </div>
                  </div>
                  <div class="install-method-panel__meta">
                    <div>${this.copy.downloadVersionLabel}: <span id="desktop-version" class="font-semibold text-foreground">${DESKTOP_RELEASE_FALLBACK.version}</span></div>
                    <div>${this.copy.downloadDetectedLabel}: <span id="desktop-detected-platform" class="font-semibold text-foreground">${this.copy.downloadUnknownPlatform}</span></div>
                    <div>${this.copy.downloadReleaseLabel}: <a id="desktop-release-link" href="${DESKTOP_RELEASE_FALLBACK.url}" target="_blank" rel="noopener noreferrer" class="font-semibold text-primary hover:underline">${DESKTOP_RELEASE_FALLBACK.tag}</a></div>
                  </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  ${this.copy.downloadOptions.map((option) => this.renderDownloadCard(option)).join('')}
                </div>

                <div class="mt-4 rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-900">
                  ${this.copy.downloadUnsignedNotice}
                </div>

                <a id="desktop-release-link-secondary" href="${DESKTOP_RELEASE_FALLBACK.url}" target="_blank" rel="noopener noreferrer" class="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
                  <i data-lucide="external-link" class="w-4 h-4"></i>
                  ${this.copy.downloadReleaseLinkText}
                </a>

                <details class="desktop-open-guide">
                  <summary>
                    <span>${this.copy.downloadOpenGuideTitle}</span>
                    <i data-lucide="chevron-down" class="h-4 w-4"></i>
                  </summary>
                  <div class="desktop-open-guide__grid">
                    <div>
                      <h3>${this.copy.downloadMacGuideTitle}</h3>
                      <ol>${this.copy.downloadMacGuideSteps.map((step) => `<li>${step}</li>`).join('')}</ol>
                    </div>
                    <div>
                      <h3>${this.copy.downloadWindowsGuideTitle}</h3>
                      <ol>${this.copy.downloadWindowsGuideSteps.map((step) => `<li>${step}</li>`).join('')}</ol>
                    </div>
                    <div>
                      <h3>${this.copy.downloadLinuxGuideTitle}</h3>
                      <ol>${this.copy.downloadLinuxGuideSteps.map((step) => `<li>${step}</li>`).join('')}</ol>
                    </div>
                  </div>
                </details>
              </section>

              ${this.copy.installMethods.map((method) => this.renderInstallMethodCard(method, docsLink)).join('')}
            </div>
          </section>
          ` : ''}

          ${this.route === 'useCases' ? renderUseCasesPage(this.copy, downloadRoute, docsLink) : ''}

          ${this.route === 'integrations' ? renderIntegrationsPage(this.copy, downloadRoute, docsLink) : ''}

          ${this.route === 'releases' ? renderReleasesPage(this.copy, downloadRoute) : ''}

          </div>
        </main>
        ${this.route === 'home' ? renderHomeSections(this.copy, docsLink, this.locale) : ''}
        ${renderLandingFooter(this.copy, docsLink, releasesRoute)}

      </div>
    `;

    this.bindLocaleSelect();
    this.bindHomeLinkAction();
    this.bindMobileMenu();
    this.bindCommunityQrModal();
    this.bindDesktopDownloads();
    this.bindInstallCopyButtons();
    this.bindInstallMethodNavigation();
    this.mediaObserver = bindInteractiveArtifactMedia(this.root);
    createIcons({ icons, nameAttr: 'data-lucide' });
  };

  private bindInstallMethodNavigation = (): void => {
    const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('[data-install-method-link]'));
    if (links.length === 0) {
      return;
    }
    const navigation = links[0]?.closest<HTMLElement>('.install-method-nav');
    if (!navigation) {
      return;
    }

    const setCurrent = (panelId: string): void => {
      links.forEach((link) => {
        if (link.dataset.installMethodLink === panelId) {
          link.setAttribute('aria-current', 'true');
        } else {
          link.removeAttribute('aria-current');
        }
      });
    };

    links.forEach((link) => {
      link.addEventListener('click', () => {
        const panelId = link.dataset.installMethodLink;
        if (panelId) {
          setCurrent(panelId);
        }
      });
    });

    const panels = links
      .map((link) => document.getElementById(link.dataset.installMethodLink ?? ''))
      .filter((panel): panel is HTMLElement => panel !== null);
    let frameRequest: number | null = null;
    const updateNavigationState = (): void => {
      frameRequest = null;
      const stickyTop = Number.parseFloat(window.getComputedStyle(navigation).top) || 0;
      navigation.classList.toggle('is-stuck', navigation.getBoundingClientRect().top <= stickyTop + 1);
      const viewportCenter = window.innerHeight / 2;
      const closestPanel = panels
        .map((panel) => {
          const bounds = panel.getBoundingClientRect();
          return { panel, distance: Math.abs((bounds.top + bounds.bottom) / 2 - viewportCenter) };
        })
        .sort((left, right) => left.distance - right.distance)[0]?.panel;
      if (closestPanel) {
        setCurrent(closestPanel.id);
      }
    };

    window.addEventListener('scroll', () => {
      if (frameRequest === null) {
        frameRequest = window.requestAnimationFrame(updateNavigationState);
      }
    }, { passive: true });
    updateNavigationState();
  };

  private bindDesktopDownloads = (): void => {
    const versionNode = document.querySelector<HTMLElement>('#desktop-version');
    const detectedNode = document.querySelector<HTMLElement>('#desktop-detected-platform');
    const releasePrimary = document.querySelector<HTMLAnchorElement>('#desktop-release-link');
    const releaseSecondary = document.querySelector<HTMLAnchorElement>('#desktop-release-link-secondary');
    const windowsPortableLink = document.querySelector<HTMLAnchorElement>('#desktop-windows-portable-link');

    const linkNodes: Record<DownloadAssetKey, HTMLAnchorElement | null> = {
      macArm64Dmg: document.querySelector<HTMLAnchorElement>('[data-download-link="macArm64Dmg"]'),
      macX64Dmg: document.querySelector<HTMLAnchorElement>('[data-download-link="macX64Dmg"]'),
      windowsX64Installer: document.querySelector<HTMLAnchorElement>('[data-download-link="windowsX64Installer"]'),
      linuxX64AppImage: document.querySelector<HTMLAnchorElement>('[data-download-link="linuxX64AppImage"]')
    };

    if (
      !linkNodes.macArm64Dmg ||
      !linkNodes.macX64Dmg ||
      !linkNodes.windowsX64Installer ||
      !linkNodes.linuxX64AppImage ||
      !releasePrimary ||
      !releaseSecondary
    ) {
      return;
    }
    const macDownloadLink = linkNodes.macArm64Dmg;
    const macX64DownloadLink = linkNodes.macX64Dmg;
    const windowsDownloadLink = linkNodes.windowsX64Installer;
    const linuxDownloadLink = linkNodes.linuxX64AppImage;

    const cardNodes: Record<DownloadAssetKey, HTMLElement | null> = {
      macArm64Dmg: document.querySelector<HTMLElement>('[data-download-card="macArm64Dmg"]'),
      macX64Dmg: document.querySelector<HTMLElement>('[data-download-card="macX64Dmg"]'),
      windowsX64Installer: document.querySelector<HTMLElement>('[data-download-card="windowsX64Installer"]'),
      linuxX64AppImage: document.querySelector<HTMLElement>('[data-download-card="linuxX64AppImage"]')
    };

    const applyReleaseInfo = (release: DesktopReleaseInfo): void => {
      if (versionNode) {
        versionNode.textContent = release.version;
      }
      if (releasePrimary) {
        releasePrimary.textContent = release.tag;
        releasePrimary.href = release.url;
      }
      if (releaseSecondary) {
        releaseSecondary.href = release.url;
      }
      macDownloadLink.setAttribute('href', release.assets.macArm64Dmg);
      macX64DownloadLink.setAttribute('href', release.assets.macX64Dmg);
      windowsDownloadLink.setAttribute('href', release.assets.windowsX64Installer);
      linuxDownloadLink.setAttribute('href', release.assets.linuxX64AppImage);
      if (windowsPortableLink) {
        windowsPortableLink.href = release.windowsPortableZipUrl ?? release.url;
      }
    };

    const recommended = detectRecommendedDesktopAsset();
    const userAgent = navigator.userAgent.toLowerCase();
    if (detectedNode) {
      if (recommended === 'unknown') {
        if (userAgent.includes('mac')) {
          detectedNode.textContent = this.locale === 'zh' ? 'macOS（请选择芯片）' : 'macOS (choose your chip)';
        } else {
          detectedNode.textContent = this.copy.downloadUnknownPlatform;
        }
      } else {
        const match = this.copy.downloadOptions.find((option) => option.key === recommended);
        detectedNode.textContent = match?.title ?? this.copy.downloadUnknownPlatform;
      }
    }

    if (recommended !== 'unknown') {
      const recommendedCard = cardNodes[recommended];
      if (recommendedCard) {
        recommendedCard.classList.add('ring-2', 'ring-primary/60', 'shadow-xl', 'shadow-primary/10');
      }
    }

    applyReleaseInfo(DESKTOP_RELEASE_FALLBACK);

    void (async () => {
      const latestRelease = await fetchLatestStableDesktopRelease();
      if (!latestRelease) {
        return;
      }
      applyReleaseInfo(latestRelease);
    })();
  };

  private bindInstallCopyButtons = (): void => {
    const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-install-copy-button]'));
    for (const button of buttons) {
      button.addEventListener('click', async () => {
        const card = button.closest<HTMLElement>('[data-install-method-card]');
        const command = card?.querySelector<HTMLElement>('code')?.textContent?.trim();
        if (!command) {
          return;
        }

        try {
          await navigator.clipboard.writeText(command);
          button.textContent = this.copy.installCopiedText;
          window.setTimeout(() => {
            button.textContent = this.copy.installCopyLabel;
          }, 1200);
        } catch (error) {
          console.error('Failed to copy install command', error);
        }
      });
    }
  };

  private bindMobileMenu = (): void => {
    const menuBtn = document.querySelector<HTMLButtonElement>('#mobile-menu-btn');
    const mobileMenu = document.querySelector<HTMLElement>('#mobile-menu');
    if (!menuBtn || !mobileMenu) {
      return;
    }
    menuBtn.addEventListener('click', () => {
      mobileMenu.classList.toggle('hidden');
    });
    // Close menu when clicking a link
    mobileMenu.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        mobileMenu.classList.add('hidden');
      });
    });
  };

  private bindCommunityQrModal = (): void => {
    const btn = document.querySelector<HTMLButtonElement>('#community-qr-btn');
    const modal = document.querySelector<HTMLElement>('#community-qr-modal');
    if (!btn || !modal) {
      return;
    }
    btn.addEventListener('click', () => {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    });
    modal.addEventListener('click', () => {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    });
  };

  private bindLocaleSelect = (): void => {
    const select = document.querySelector<HTMLSelectElement>('#locale-select');
    if (!select) {
      return;
    }
    select.addEventListener('change', () => {
      const next = select.value;
      if (!isLocale(next) || next === this.locale) {
        return;
      }
      persistLocale(next);
      window.location.href = ROUTES[next][this.route];
    });
  };

  private bindHomeLinkAction = (): void => {
    const homeLink = document.querySelector<HTMLAnchorElement>('#home-link');
    if (!homeLink) {
      return;
    }
    homeLink.addEventListener('click', (event) => {
      if (this.route !== 'home') {
        return;
      }
      event.preventDefault();
      if (window.location.hash) {
        window.history.replaceState(null, '', ROUTES[this.locale].home);
      }
      window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    });
  };

}

const root = document.querySelector<HTMLDivElement>('#app');
if (!root) {
  throw new Error('Missing #app mount element');
}

const locale = resolvePageLocale();
const route = resolvePageRoute();
persistLocale(locale);
new LandingPage(root, locale, route).render();
