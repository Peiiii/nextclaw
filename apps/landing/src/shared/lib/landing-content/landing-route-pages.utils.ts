import type { FeatureItem, LandingCopy, PageRoute, ShowcaseItem } from './landing-content.types';
import { LINKS } from './landing-route.utils';

export function renderShowcaseCards(
  items: ShowcaseItem[],
  options: { cardClass?: (index: number) => string; eagerCount?: number } = {}
): string {
  return items.map((item, index) => {
    const cardClass = options.cardClass ? ` ${options.cardClass(index)}` : '';
    const loading = index < (options.eagerCount ?? 1) ? 'eager' : 'lazy';

    return `
      <article class="showcase-card${cardClass}">
        <div class="showcase-card__copy">
          <p class="showcase-card__eyebrow">${item.eyebrow}</p>
          <h3 class="showcase-card__title">${item.title}</h3>
          <p class="showcase-card__description">${item.description}</p>
        </div>
        <a href="${item.imageSrc}" target="_blank" rel="noopener noreferrer" class="showcase-card__media">
          <img src="${item.imageSrc}" alt="${item.imageAlt}" class="showcase-card__image" loading="${loading}" />
        </a>
      </article>
    `;
  }).join('');
}

export function getPageTitle(route: PageRoute, copy: LandingCopy): string {
  switch (route) {
    case 'download':
      return copy.downloadTitle;
    case 'install':
      return copy.installTitle;
    case 'useCases':
      return copy.useCasesPageTitle;
    case 'integrations':
      return copy.integrationsTitle;
    case 'releases':
      return copy.releasesTitle;
    case 'home':
    default:
      return copy.heroTitleLine1;
  }
}

export function getPageSubtitle(route: PageRoute, copy: LandingCopy): string {
  switch (route) {
    case 'download':
      return copy.downloadSubtitle;
    case 'install':
      return copy.installSubtitle;
    case 'useCases':
      return copy.useCasesPageSubtitle;
    case 'integrations':
      return copy.integrationsSubtitle;
    case 'releases':
      return copy.releasesSubtitle;
    case 'home':
    default:
      return copy.heroDescription;
  }
}

export function renderFeatureCards(items: FeatureItem[]): string {
  return items.map((item) => `
    <article class="rounded-lg border border-border/70 bg-white p-5 shadow-sm">
      <div class="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <i data-lucide="${item.icon}" class="h-5 w-5"></i>
      </div>
      <h3 class="text-lg font-semibold">${item.title}</h3>
      <p class="mt-3 text-sm leading-relaxed text-muted-foreground">${item.description}</p>
    </article>
  `).join('');
}

export function renderEcosystemGroups(copy: LandingCopy): string {
  return copy.ecosystemGroups.map((group) => `
    <article class="rounded-lg border border-border/70 bg-white p-6 shadow-sm">
      <div class="mb-5 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <i data-lucide="${group.icon}" class="h-5 w-5"></i>
      </div>
      <h3 class="text-xl font-semibold">${group.title}</h3>
      <p class="mt-3 text-sm leading-relaxed text-muted-foreground">${group.description}</p>
      <div class="mt-6 flex flex-wrap gap-2">
        ${group.items.map((item) => `
          <span class="inline-flex h-9 items-center gap-2 rounded-lg border border-border/70 bg-secondary/50 px-3 text-sm font-medium text-foreground">
            ${item.logo ? `<img src="${item.logo}" alt="" class="h-4 w-4 object-contain" loading="lazy" />` : ''}
            ${item.label}
          </span>
        `).join('')}
      </div>
    </article>
  `).join('');
}

export function renderUseCasesPage(copy: LandingCopy, downloadRoute: string, docsLink: string): string {
  return `
    <section class="w-full max-w-7xl mx-auto text-left animate-slide-up opacity-0" style="animation-delay: 0.35s">
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        ${renderFeatureCards(copy.useCases)}
      </div>
    </section>
    <section class="w-full max-w-5xl mx-auto mt-12 text-left animate-slide-up opacity-0">
      <div class="rounded-lg border border-border/70 bg-secondary/55 p-6 md:p-8">
        <h2 class="text-2xl md:text-3xl font-bold tracking-normal">${copy.useCasesCtaTitle}</h2>
        <p class="mt-3 max-w-3xl text-muted-foreground">${copy.useCasesCtaDescription}</p>
        <div class="mt-6 flex flex-col gap-3 sm:flex-row">
          <a href="${downloadRoute}" class="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
            <i data-lucide="download" class="h-4 w-4"></i>
            ${copy.heroDownloadButton}
          </a>
          <a href="${docsLink}" target="_blank" rel="noopener noreferrer" class="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground hover:bg-secondary transition-colors">
            <i data-lucide="book-open" class="h-4 w-4"></i>
            ${copy.docsButton}
          </a>
        </div>
      </div>
    </section>
  `;
}

export function renderComparisonSection(copy: LandingCopy): string {
  const comparison = copy.comparison;
  const stageLabels = [comparison.startLabel, comparison.focusLabel, comparison.bestForLabel];

  return `
    <section id="compare" class="comparison-section">
      <div class="comparison-inner">
        <div class="comparison-header">
          <p class="comparison-eyebrow">
            <i data-lucide="scale" class="h-4 w-4"></i>
            ${comparison.eyebrow}
          </p>
          <h2 class="comparison-title">${comparison.title}</h2>
          <p class="comparison-subtitle">${comparison.subtitle}</p>
        </div>

        <div class="comparison-board">
          ${comparison.lanes.map((lane) => {
            const stages = [lane.start, lane.focus, lane.bestFor];
            return `
              <article class="comparison-lane${lane.featured ? ' comparison-lane--featured' : ''}">
                <header class="comparison-product">
                  <div class="comparison-product__icon">
                    <i data-lucide="${lane.icon}" class="h-5 w-5"></i>
                  </div>
                  <div>
                    <h3 class="comparison-product__name">${lane.product}</h3>
                    <p class="comparison-product__category">${lane.category}</p>
                  </div>
                  <a href="${lane.sourceUrl}" target="_blank" rel="noopener noreferrer" class="comparison-product__source">
                    ${lane.sourceLabel}
                    <i data-lucide="external-link" class="h-3.5 w-3.5"></i>
                  </a>
                </header>
                <div class="comparison-flow">
                  ${stages.map((stage, index) => `
                    <div class="comparison-stage">
                      <span class="comparison-stage__label">${stageLabels[index]}</span>
                      <p class="comparison-stage__text">${stage}</p>
                    </div>
                  `).join('')}
                </div>
              </article>
            `;
          }).join('')}
        </div>

        <div class="comparison-proof">
          <div class="comparison-proof__header">
            <h3>${comparison.proofTitle}</h3>
            <p>${comparison.proofDescription}</p>
          </div>
          <div class="comparison-proof__grid">
            ${comparison.proofs.map((proof) => `
              <article class="comparison-proof__item">
                <div class="comparison-proof__icon">
                  <i data-lucide="${proof.icon}" class="h-5 w-5"></i>
                </div>
                <h4>${proof.title}</h4>
                <p>${proof.description}</p>
                <a href="${proof.href}" target="_blank" rel="noopener noreferrer">
                  ${proof.linkLabel}
                  <i data-lucide="arrow-up-right" class="h-3.5 w-3.5"></i>
                </a>
              </article>
            `).join('')}
          </div>
        </div>

        <p class="comparison-source-note">
          <i data-lucide="info" class="h-4 w-4"></i>
          ${comparison.sourceNote}
        </p>
      </div>
    </section>
  `;
}

export function renderLandingFooter(copy: LandingCopy, docsLink: string, releasesRoute: string): string {
  return `
    <footer class="w-full border-t border-border/40 py-10 z-10 bg-background/50 backdrop-blur-sm mt-auto">
      <div class="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
        <div class="flex items-center gap-2 opacity-80">
          <img src="/logo-phoenix.svg" alt="NextClaw" class="w-6 h-6" />
          <span class="font-medium text-sm">${copy.footerProject}</span>
        </div>
        <div class="text-sm text-muted-foreground">${copy.footerLicense}</div>
        <div class="flex gap-4">
          <a href="${docsLink}" target="_blank" rel="noopener noreferrer" class="text-muted-foreground hover:text-foreground transition-colors">${copy.footerDocs}</a>
          <a href="${releasesRoute}" class="text-muted-foreground hover:text-foreground transition-colors">${copy.footerReleases}</a>
          <a href="${LINKS.github}" target="_blank" rel="noopener noreferrer" class="text-muted-foreground hover:text-foreground transition-colors">GitHub</a>
          <a href="${LINKS.npm}" target="_blank" rel="noopener noreferrer" class="text-muted-foreground hover:text-foreground transition-colors">${copy.footerNpm}</a>
          <a href="${LINKS.discord}" target="_blank" rel="noopener noreferrer" class="text-muted-foreground hover:text-foreground transition-colors">${copy.footerDiscord}</a>
          <a href="${LINKS.wechatGroupImage}" target="_blank" rel="noopener noreferrer" class="text-muted-foreground hover:text-foreground transition-colors" title="${copy.footerWechatGroup}">${copy.footerWechatGroup}</a>
        </div>
      </div>
    </footer>
  `;
}

export function renderIntegrationsPage(copy: LandingCopy, installRoute: string, docsLink: string): string {
  return `
    <section class="w-full max-w-7xl mx-auto text-left animate-slide-up opacity-0" style="animation-delay: 0.35s">
      <div class="integration-showcase-grid">
        ${renderShowcaseCards(copy.integrationShowcaseItems, { eagerCount: 2 })}
      </div>
    </section>
    <section class="w-full max-w-7xl mx-auto mt-14 text-left animate-slide-up opacity-0">
      <div class="mb-10 max-w-3xl">
        <h2 class="text-3xl md:text-5xl font-bold tracking-normal mb-4">${copy.ecosystemTitle}</h2>
        <p class="text-muted-foreground text-lg">${copy.ecosystemSubtitle}</p>
      </div>
      <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
        ${renderEcosystemGroups(copy)}
      </div>
      <div class="mt-8 flex flex-col gap-3 sm:flex-row">
        <a href="${docsLink}" target="_blank" rel="noopener noreferrer" class="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
          <i data-lucide="book-open" class="h-4 w-4"></i>
          ${copy.integrationsDocsButton}
        </a>
        <a href="${installRoute}" class="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground hover:bg-secondary transition-colors">
          <i data-lucide="terminal" class="h-4 w-4"></i>
          ${copy.integrationsInstallButton}
        </a>
      </div>
    </section>
  `;
}

export function renderReleasesPage(copy: LandingCopy, downloadRoute: string): string {
  return `
    <section class="w-full max-w-6xl mx-auto text-left animate-slide-up opacity-0" style="animation-delay: 0.35s">
      <div class="grid grid-cols-1 gap-5 lg:grid-cols-3">
        ${copy.releaseNotes.map((note) => `
          <article class="rounded-lg border border-border/70 bg-white p-6 shadow-sm">
            <span class="inline-flex rounded-lg border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">${note.category}</span>
            <h2 class="mt-4 text-xl font-bold tracking-normal">${note.title}</h2>
            <p class="mt-3 text-sm leading-relaxed text-muted-foreground">${note.description}</p>
            <ul class="mt-5 space-y-3 text-sm text-muted-foreground">
              ${note.items.map((item) => `
                <li class="flex gap-2">
                  <i data-lucide="check" class="mt-0.5 h-4 w-4 shrink-0 text-primary"></i>
                  <span>${item}</span>
                </li>
              `).join('')}
            </ul>
          </article>
        `).join('')}
      </div>
      <div class="mt-8 flex flex-col gap-3 sm:flex-row">
        <a href="${LINKS.github}/releases" target="_blank" rel="noopener noreferrer" class="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
          <i data-lucide="external-link" class="h-4 w-4"></i>
          ${copy.releasesGitHubButton}
        </a>
        <a href="${downloadRoute}" class="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground hover:bg-secondary transition-colors">
          <i data-lucide="download" class="h-4 w-4"></i>
          ${copy.releasesDownloadButton}
        </a>
      </div>
    </section>
  `;
}
