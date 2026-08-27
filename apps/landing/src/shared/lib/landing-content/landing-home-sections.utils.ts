import "@/proactive-delivery-showcase.css";

import type {
  LandingCopy,
  Locale,
  ProactiveDeliveryShowcase,
} from "./landing-content.types";
import {
  renderComparisonSection,
  renderEcosystemGroups,
  renderFeatureCards,
  renderRuntimeShowcase,
  renderShowcaseCards,
} from "./landing-route-pages.utils";
import { PROACTIVE_DELIVERY_COPY } from "./landing-proactive-delivery.config";
import { LINKS } from "./landing-route.utils";
import { renderInteractiveArtifactShowcase } from "./utils/interactive-artifact.utils";

function renderProactiveDeliveryShowcase(
  showcase: ProactiveDeliveryShowcase,
  docsLink: string,
): string {
  return `
    <section class="proactive-delivery-section">
      <div class="proactive-delivery-inner">
        <div class="proactive-delivery-header">
          <p class="proactive-delivery-eyebrow">
            <i data-lucide="inbox" aria-hidden="true"></i>
            ${showcase.eyebrow}
          </p>
          <h2 class="proactive-delivery-title">${showcase.title}</h2>
          <p class="proactive-delivery-description">${showcase.description}</p>
          <a
            href="${docsLink}guide/background-results"
            target="_blank"
            rel="noopener noreferrer"
            class="proactive-delivery-link"
          >
            ${showcase.guideLabel}
            <i data-lucide="arrow-up-right" aria-hidden="true"></i>
          </a>
        </div>

        <div class="proactive-delivery-grid">
          <figure class="proactive-delivery-card proactive-delivery-card--inbox">
            <figcaption>
              <span>${showcase.inboxLabel}</span>
              <strong>${showcase.inboxTitle}</strong>
            </figcaption>
            <div class="proactive-delivery-media proactive-delivery-media--inbox">
              <img src="${showcase.inboxImageSrc}" alt="${showcase.inboxImageAlt}" loading="lazy" />
            </div>
          </figure>

          <figure class="proactive-delivery-card proactive-delivery-card--notification">
            <figcaption>
              <span>${showcase.notificationLabel}</span>
              <strong>${showcase.notificationTitle}</strong>
            </figcaption>
            <div class="proactive-delivery-media proactive-delivery-media--notification">
              <img src="${showcase.notificationImageSrc}" alt="${showcase.notificationImageAlt}" loading="lazy" />
            </div>
          </figure>
        </div>
      </div>
    </section>
  `;
}

export function renderHomeSections(
  copy: LandingCopy,
  docsLink: string,
  locale: Locale,
): string {
  return `
    <section id="features" class="py-16 px-6 z-10 w-full max-w-7xl mx-auto">
      <div class="mb-12 max-w-3xl">
        <h2 class="text-3xl md:text-5xl font-bold tracking-normal mb-4">${copy.showcaseTitle}</h2>
        <p class="text-muted-foreground text-lg">${copy.showcaseSubtitle}</p>
      </div>
      <div class="showcase-grid">${renderShowcaseCards(copy.showcaseItems)}</div>
    </section>

    ${renderInteractiveArtifactShowcase(locale)}

    ${renderRuntimeShowcase(copy.runtimeShowcase)}

    ${renderProactiveDeliveryShowcase(PROACTIVE_DELIVERY_COPY[locale], docsLink)}

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

    <section class="landing-cta-section py-24 px-6 z-10 w-full max-w-4xl mx-auto text-center">
      <div class="landing-cta-card glass-card rounded-[2rem] p-12 relative overflow-hidden">
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

    <section id="community" class="landing-community-section py-20 px-6 z-10 w-full max-w-4xl mx-auto">
      <div class="text-center mb-12">
        <h2 class="text-3xl md:text-4xl font-bold tracking-normal mb-3">${copy.communityTitle}</h2>
        <p class="text-muted-foreground text-lg">${copy.communitySubtitle}</p>
      </div>
      <div class="max-w-sm mx-auto">
        <a href="${LINKS.wechatGroupImage}" target="_blank" rel="noopener noreferrer" class="glass-card rounded-2xl p-6 flex flex-col items-center gap-4 hover:-translate-y-1 transition-transform focus:ring-2 focus:ring-primary focus:outline-none">
          <img src="${LINKS.wechatGroupImage}" alt="${copy.communityWechatLabel}" class="w-40 h-40 object-contain rounded-lg" />
          <span class="font-medium text-foreground">${copy.communityWechatLabel}</span>
          <span class="text-sm text-muted-foreground">${copy.communityScanHint}</span>
        </a>
      </div>
    </section>
  `;
}
