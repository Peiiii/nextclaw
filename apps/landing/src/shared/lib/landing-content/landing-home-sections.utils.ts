import type { LandingCopy } from "./landing-content.types";
import {
  renderComparisonSection,
  renderEcosystemGroups,
  renderFeatureCards,
  renderRuntimeShowcase,
  renderShowcaseCards,
} from "./landing-route-pages.utils";
import { LINKS } from "./landing-route.utils";

export function renderHomeSections(
  copy: LandingCopy,
  docsLink: string,
): string {
  return `
    <section id="features" class="py-16 px-6 z-10 w-full max-w-7xl mx-auto">
      <div class="mb-12 max-w-3xl">
        <h2 class="text-3xl md:text-5xl font-bold tracking-normal mb-4">${copy.showcaseTitle}</h2>
        <p class="text-muted-foreground text-lg">${copy.showcaseSubtitle}</p>
      </div>
      <div class="showcase-grid">${renderShowcaseCards(copy.showcaseItems)}</div>
    </section>

    ${renderRuntimeShowcase(copy.runtimeShowcase)}

    <section class="app-surface-section">
      <div class="w-full max-w-7xl mx-auto">
        <div class="mb-12 max-w-3xl">
          <h2 class="text-3xl md:text-5xl font-bold tracking-normal mb-4">${copy.appSurfaceTitle}</h2>
          <p class="text-muted-foreground text-lg">${copy.appSurfaceSubtitle}</p>
        </div>
        <div class="app-surface-grid">
          ${renderShowcaseCards(copy.appSurfaceItems, {
            cardClass: (index) =>
              `app-surface-card ${index < 2 ? "app-surface-card--feature" : "app-surface-card--compact"}`,
            eagerCount: 2,
          })}
        </div>
      </div>
    </section>

    <section class="py-16 px-6 z-10 w-full max-w-7xl mx-auto">
      <div class="mb-12 max-w-3xl">
        <h2 class="text-3xl md:text-5xl font-bold tracking-normal mb-4">${copy.useCasesTitle}</h2>
        <p class="text-muted-foreground text-lg">${copy.useCasesSubtitle}</p>
      </div>
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">${renderFeatureCards(copy.useCases)}</div>
    </section>

    <section class="collaboration-section">
      <div class="collaboration-inner">
        <div class="collaboration-header">
          <h2 class="text-3xl md:text-5xl font-bold tracking-normal mb-4">${copy.featuresTitle}</h2>
          <p class="text-muted-foreground text-lg">${copy.featuresSubtitle}</p>
        </div>
        <div class="collaboration-grid">
          ${copy.features
            .map(
              (feature) => `
            <article class="collaboration-card">
              <div class="collaboration-card__icon"><i data-lucide="${feature.icon}" class="h-5 w-5"></i></div>
              <h3 class="collaboration-card__title">${feature.title}</h3>
              <p class="collaboration-card__description">${feature.description}</p>
            </article>
          `,
            )
            .join("")}
        </div>
      </div>
    </section>

    <section class="py-16 px-6 z-10 w-full max-w-7xl mx-auto">
      <div class="mb-12 max-w-3xl">
        <h2 class="text-3xl md:text-5xl font-bold tracking-normal mb-4">${copy.ecosystemTitle}</h2>
        <p class="text-muted-foreground text-lg">${copy.ecosystemSubtitle}</p>
      </div>
      <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">${renderEcosystemGroups(copy)}</div>
    </section>

    ${renderComparisonSection(copy)}

    <section id="faq" class="py-20 px-6 z-10 w-full max-w-4xl mx-auto">
      <div class="text-center mb-12">
        <h2 class="text-3xl md:text-4xl font-bold tracking-normal mb-4">${copy.faqTitle}</h2>
        <p class="text-muted-foreground text-lg max-w-2xl mx-auto">${copy.faqSubtitle}</p>
      </div>
      <div class="space-y-4">
        ${copy.faq
          .map(
            (item) => `
          <details class="glass-card rounded-2xl border border-border/50 group">
            <summary class="px-6 py-5 cursor-pointer flex items-center justify-between text-left font-medium hover:text-primary transition-colors list-none">
              <span>${item.question}</span>
              <i data-lucide="chevron-down" class="w-5 h-5 text-muted-foreground group-open:rotate-180 transition-transform shrink-0 ml-4"></i>
            </summary>
            <div class="px-6 pb-5 text-muted-foreground leading-relaxed">${item.answer}</div>
          </details>
        `,
          )
          .join("")}
      </div>
    </section>

    <section class="py-24 px-6 z-10 w-full max-w-4xl mx-auto text-center">
      <div class="glass-card rounded-[2rem] p-12 relative overflow-hidden">
        <div class="absolute inset-0 bg-primary/5"></div>
        <div class="relative z-10">
          <h2 class="text-3xl md:text-5xl font-bold mb-6">${copy.ctaTitle}</h2>
          <p class="text-lg text-muted-foreground mb-10 max-w-xl mx-auto">${copy.ctaDescription}</p>
          <a href="${docsLink}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center justify-center gap-2 h-14 px-8 rounded-full font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-transform hover:scale-105 shadow-xl shadow-primary/20 focus:ring-2 focus:ring-primary focus:outline-none text-lg">
            ${copy.ctaButton}<i data-lucide="arrow-right" class="w-5 h-5 ml-1"></i>
          </a>
        </div>
      </div>
    </section>

    <section id="community" class="py-20 px-6 z-10 w-full max-w-4xl mx-auto">
      <div class="text-center mb-12">
        <h2 class="text-3xl md:text-4xl font-bold tracking-normal mb-3">${copy.communityTitle}</h2>
        <p class="text-muted-foreground text-lg">${copy.communitySubtitle}</p>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-2xl mx-auto">
        <a href="${LINKS.wechatGroupImage}" target="_blank" rel="noopener noreferrer" class="glass-card rounded-2xl p-6 flex flex-col items-center gap-4 hover:-translate-y-1 transition-transform focus:ring-2 focus:ring-primary focus:outline-none">
          <img src="${LINKS.wechatGroupImage}" alt="${copy.communityWechatLabel}" class="w-40 h-40 object-contain rounded-lg" />
          <span class="font-medium text-foreground">${copy.communityWechatLabel}</span>
          <span class="text-sm text-muted-foreground">${copy.communityScanHint}</span>
        </a>
        <a href="${LINKS.discord}" target="_blank" rel="noopener noreferrer" class="glass-card rounded-2xl p-6 flex flex-col items-center justify-center gap-4 hover:-translate-y-1 transition-transform focus:ring-2 focus:ring-primary focus:outline-none">
          <div class="w-20 h-20 rounded-2xl bg-[#5865F2] flex items-center justify-center text-white">
            <svg class="w-12 h-12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.075.075 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>
          </div>
          <span class="font-medium text-foreground text-lg">${copy.communityDiscordLabel}</span>
          <span class="text-sm text-muted-foreground">NextClaw / OpenClaw</span>
        </a>
      </div>
    </section>
  `;
}
