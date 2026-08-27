import type { Locale } from "@/shared/lib/landing-content/landing-content.types";

const INTERACTIVE_ARTIFACT_COPY: Record<Locale, {
  eyebrow: string;
  title: string;
  description: string;
  imageAlt: string;
  caption: string;
  firstTitle: string;
  firstDescription: string;
  secondTitle: string;
  secondDescription: string;
}> = {
  zh: {
    eyebrow: "聊天里的互动成果",
    title: "把一个能操作的工程工具，直接放进对话里。",
    description: "这是实际 NextClaw 会话里的悬臂梁评估。拖动载荷、长度和安全系数，曲线、读数和结论会在这条回复里同步变化。",
    imageAlt: "NextClaw 会话中，用户请求悬臂梁评估，助手在同一条消息里展示可直接操作的参数、曲线和安全结论。",
    caption: "真实 NextClaw 会话录屏：这是消息内的 Panel App，不是官网另画的一组控件。",
    firstTitle: "先在这条回复里直接操作",
    firstDescription: "拖动参数时，图、数字和结论即时联动；任务的输入和可操作结果留在同一个上下文里。",
    secondTitle: "需要时再展开继续用",
    secondDescription: "想长期查看、填写或操作时，把同一个结果展开为 Panel App，在工作台里继续完成任务。",
  },
  en: {
    eyebrow: "Interactive results in chat",
    title: "Put an interactive engineering tool directly in the conversation.",
    description: "This public NextClaw example checks a cantilever beam. Move load, length, or safety factor and its curve, readings, and conclusion update in the same reply.",
    imageAlt: "A Chinese-language NextClaw example conversation with an interactive cantilever-beam assessment inside an assistant reply.",
    caption: "A real NextClaw conversation recording: this is a Panel App inside the reply, not a separate website control.",
    firstTitle: "Operate it inside the reply first",
    firstDescription: "Changing a parameter updates the chart, numbers, and conclusion in place, while the task and the usable result stay in one context.",
    secondTitle: "Expand the same result when you need more room",
    secondDescription: "For longer viewing, editing, or repeated use, open the same result as a Panel App and keep working in the workspace.",
  },
};

export function renderInteractiveArtifactShowcase(locale: Locale): string {
  const copy = INTERACTIVE_ARTIFACT_COPY[locale];

  return `
    <section class="interactive-artifact-section" aria-labelledby="interactive-artifact-title">
      <div class="interactive-artifact-inner">
        <header class="interactive-artifact-header">
          <p class="interactive-artifact-eyebrow"><i data-lucide="message-circle" aria-hidden="true"></i>${copy.eyebrow}</p>
          <h2 id="interactive-artifact-title" class="interactive-artifact-title">${copy.title}</h2>
          <p class="interactive-artifact-description">${copy.description}</p>
        </header>

        <figure class="interactive-artifact-product-shot">
          <div class="interactive-artifact-product-shot__media">
            <video
              src="/nextclaw-inline-engineering-20260827-demo.webm"
              poster="/nextclaw-inline-engineering-20260827-cn.webp"
              aria-label="${copy.imageAlt}"
              autoplay
              muted
              loop
              playsinline
              controls
              preload="metadata"
            >
              <img src="/nextclaw-inline-engineering-20260827-cn.webp" alt="${copy.imageAlt}" loading="lazy" />
            </video>
          </div>
          <figcaption>${copy.caption}</figcaption>
        </figure>

        <ol class="interactive-artifact-path">
          <li>
            <span aria-hidden="true">01</span>
            <div><strong>${copy.firstTitle}</strong><p>${copy.firstDescription}</p></div>
          </li>
          <li>
            <span aria-hidden="true">02</span>
            <div><strong>${copy.secondTitle}</strong><p>${copy.secondDescription}</p></div>
          </li>
        </ol>
      </div>
    </section>
  `;
}
