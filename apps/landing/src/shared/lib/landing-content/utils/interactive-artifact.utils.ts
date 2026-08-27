import type { Locale } from "../landing-content.types";

const INTERACTIVE_ARTIFACT_COPY: Record<Locale, {
  eyebrow: string;
  title: string;
  description: string;
  controlLabel: string;
  exploreLabel: string;
  shipLabel: string;
  canvasLabel: string;
  conversationLabel: string;
  userMessage: string;
  assistantLabel: string;
  resultTitle: string;
  resultDescription: string;
  continuingLabel: string;
  liveLabel: string;
  researchLabel: string;
  synthesisLabel: string;
  actionLabel: string;
}> = {
  zh: {
    eyebrow: "聊天里的互动成果",
    title: "不是一张结果图。拖一下，它会继续回应你。",
    description: "在同一个任务里，图表、计划和临时小工具可以留在对话中继续调整。下面拖动滑块，看看一次回答怎样变成可操作的成果。",
    controlLabel: "把任务从探索推向执行",
    exploreLabel: "多一点探索",
    shipLabel: "多一点推进",
    canvasLabel: "工作节奏",
    conversationLabel: "NextClaw 会话",
    userMessage: "把这周的客户访谈整理成一个可以继续调整的计划。",
    assistantLabel: "已生成互动计划",
    resultTitle: "本周推进节奏",
    resultDescription: "拖动左边的控制项，成果会保留在这里继续变化。",
    continuingLabel: "可以继续在对话里修改",
    liveLabel: "当前安排",
    researchLabel: "资料",
    synthesisLabel: "推演",
    actionLabel: "行动",
  },
  en: {
    eyebrow: "Interactive results in chat",
    title: "Not a static answer. Pull the control and keep working with it.",
    description: "Charts, plans, and small tools can stay in the same task and respond as you refine them. Move the control below to see an answer become something you can use.",
    controlLabel: "Move the task from exploration to action",
    exploreLabel: "Explore more",
    shipLabel: "Move forward",
    canvasLabel: "Working rhythm",
    conversationLabel: "NextClaw conversation",
    userMessage: "Turn this week's customer interviews into a plan I can keep adjusting.",
    assistantLabel: "Interactive plan ready",
    resultTitle: "This week's rhythm",
    resultDescription: "Move the control on the left. The result keeps changing here.",
    continuingLabel: "Keep refining it in the conversation",
    liveLabel: "Current plan",
    researchLabel: "Research",
    synthesisLabel: "Shape",
    actionLabel: "Act",
  },
};

export function renderInteractiveArtifactShowcase(locale: Locale): string {
  const copy = INTERACTIVE_ARTIFACT_COPY[locale];

  return `
    <section class="interactive-artifact-section" aria-labelledby="interactive-artifact-title">
      <div class="interactive-artifact-inner">
        <header class="interactive-artifact-header">
          <p class="interactive-artifact-eyebrow"><i data-lucide="sparkles" aria-hidden="true"></i>${copy.eyebrow}</p>
          <h2 id="interactive-artifact-title" class="interactive-artifact-title">${copy.title}</h2>
          <p class="interactive-artifact-description">${copy.description}</p>
        </header>

        <div class="interactive-artifact-demo" data-interactive-artifact-demo data-artifact-explore-label="${copy.exploreLabel}" data-artifact-ship-label="${copy.shipLabel}" data-artifact-research-label="${copy.researchLabel}" data-artifact-synthesis-label="${copy.synthesisLabel}" data-artifact-action-label="${copy.actionLabel}">
          <div class="interactive-artifact-control">
            <div class="interactive-artifact-control__topline">
              <label for="artifact-intensity">${copy.controlLabel}</label>
              <output for="artifact-intensity" data-artifact-intensity-output>${copy.exploreLabel} 50 · ${copy.shipLabel} 50</output>
            </div>
            <input id="artifact-intensity" data-artifact-intensity type="range" min="0" max="100" value="50" aria-describedby="artifact-intensity-hint" />
            <div id="artifact-intensity-hint" class="interactive-artifact-control__ends" aria-hidden="true"><span>${copy.exploreLabel}</span><span>${copy.shipLabel}</span></div>
          </div>

          <div class="interactive-artifact-layout">
            <section class="interactive-artifact-canvas" aria-label="${copy.canvasLabel}">
              <div class="interactive-artifact-canvas__header"><span>${copy.canvasLabel}</span><strong data-artifact-pace>38% ${copy.researchLabel} · 25% ${copy.synthesisLabel} · 37% ${copy.actionLabel}</strong></div>
              <svg class="interactive-artifact-chart" viewBox="0 0 660 260" role="img" aria-label="${copy.canvasLabel}">
                <defs><linearGradient id="artifact-line" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#2a6f5e" /><stop offset="100%" stop-color="#e97d39" /></linearGradient></defs>
                <path class="interactive-artifact-chart__grid" d="M20 56H640M20 128H640M20 200H640" />
                <path class="interactive-artifact-chart__area" data-artifact-area d="M20 202 C142 199 180 90 310 106 S462 178 640 44 L640 232 L20 232Z" />
                <path class="interactive-artifact-chart__line" data-artifact-line d="M20 202 C142 199 180 90 310 106 S462 178 640 44" />
                <line class="interactive-artifact-chart__marker" data-artifact-marker x1="330" x2="330" y1="28" y2="232" />
                <circle class="interactive-artifact-chart__dot" data-artifact-dot cx="330" cy="116" r="8" />
                <g class="interactive-artifact-chart__labels" aria-hidden="true"><text x="20" y="252">${copy.researchLabel}</text><text x="292" y="252">${copy.synthesisLabel}</text><text x="590" y="252">${copy.actionLabel}</text></g>
              </svg>
              <div class="interactive-artifact-breakdown" data-artifact-breakdown>
                <span data-artifact-research><i></i>${copy.researchLabel}<strong>38%</strong></span>
                <span data-artifact-synthesis><i></i>${copy.synthesisLabel}<strong>25%</strong></span>
                <span data-artifact-action><i></i>${copy.actionLabel}<strong>37%</strong></span>
              </div>
            </section>

            <section class="interactive-artifact-conversation" aria-label="${copy.conversationLabel}">
              <div class="interactive-artifact-conversation__bar"><span class="interactive-artifact-conversation__brand"><i data-lucide="message-circle" aria-hidden="true"></i>${copy.conversationLabel}</span><span class="interactive-artifact-conversation__status"><i></i>${copy.liveLabel}</span></div>
              <p class="interactive-artifact-message interactive-artifact-message--user">${copy.userMessage}</p>
              <div class="interactive-artifact-message interactive-artifact-message--assistant">
                <span class="interactive-artifact-message__label"><i data-lucide="sparkles" aria-hidden="true"></i>${copy.assistantLabel}</span>
                <div class="interactive-artifact-result">
                  <div class="interactive-artifact-result__title-row"><strong>${copy.resultTitle}</strong><span data-artifact-result-badge>${copy.shipLabel} 50</span></div>
                  <div class="interactive-artifact-result__bars" aria-hidden="true"><span data-artifact-result-research></span><span data-artifact-result-synthesis></span><span data-artifact-result-action></span></div>
                  <p data-artifact-result-description>${copy.resultDescription}</p>
                  <span class="interactive-artifact-result__footer"><i data-lucide="mouse-pointer-2" aria-hidden="true"></i>${copy.continuingLabel}</span>
                </div>
              </div>
            </section>
          </div>
          <p class="sr-only" aria-live="polite" data-artifact-announcement></p>
        </div>
      </div>
    </section>
  `;
}
