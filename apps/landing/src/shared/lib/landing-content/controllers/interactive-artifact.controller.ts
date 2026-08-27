function setBreakdown(
  demo: HTMLElement,
  selector: string,
  percentage: number,
): void {
  const value = demo.querySelector<HTMLElement>(selector)?.querySelector<HTMLElement>("strong");
  if (value) {
    value.textContent = `${percentage}%`;
  }
}

function setResultBar(
  demo: HTMLElement,
  selector: string,
  percentage: number,
): void {
  demo.querySelector<HTMLElement>(selector)?.style.setProperty(
    "--artifact-share",
    `${percentage}`,
  );
}

export function bindInteractiveArtifactShowcase(): void {
  const demo = document.querySelector<HTMLElement>("[data-interactive-artifact-demo]");
  const slider = demo?.querySelector<HTMLInputElement>("[data-artifact-intensity]");
  if (!demo || !slider) {
    return;
  }

  const labels = {
    explore: demo.dataset.artifactExploreLabel ?? "Explore",
    ship: demo.dataset.artifactShipLabel ?? "Move forward",
    research: demo.dataset.artifactResearchLabel ?? "Research",
    synthesis: demo.dataset.artifactSynthesisLabel ?? "Shape",
    action: demo.dataset.artifactActionLabel ?? "Act",
  };
  const output = demo.querySelector<HTMLOutputElement>("[data-artifact-intensity-output]");
  const pace = demo.querySelector<HTMLElement>("[data-artifact-pace]");
  const line = demo.querySelector<SVGPathElement>("[data-artifact-line]");
  const area = demo.querySelector<SVGPathElement>("[data-artifact-area]");
  const marker = demo.querySelector<SVGLineElement>("[data-artifact-marker]");
  const dot = demo.querySelector<SVGCircleElement>("[data-artifact-dot]");
  const resultBadge = demo.querySelector<HTMLElement>("[data-artifact-result-badge]");
  const announcement = demo.querySelector<HTMLElement>("[data-artifact-announcement]");

  const update = (): void => {
    const progress = Number(slider.value) / 100;
    const research = Math.round(62 - 48 * progress);
    const synthesis = Math.round(24 + 2 * progress);
    const action = 100 - research - synthesis;
    const momentum = Math.round(progress * 100);
    const chart = {
      startY: 196 - action * 0.45,
      discoveryY: 56 + progress * 74,
      bridgeY: 94 + progress * 54,
      endingY: 188 - action * 2.18,
      beforeFinishY: 202 - action * 0.62,
      markerX: 20 + 620 * progress,
    };
    const markerY = chart.startY + (chart.endingY - chart.startY) * progress - 54 * Math.sin(progress * Math.PI);
    const curve = `M20 ${chart.startY.toFixed(1)} C140 ${chart.startY.toFixed(1)} 178 ${chart.discoveryY.toFixed(1)} 310 ${chart.bridgeY.toFixed(1)} S500 ${chart.beforeFinishY.toFixed(1)} 640 ${chart.endingY.toFixed(1)}`;

    if (output) {
      output.textContent = `${labels.explore} ${100 - momentum} · ${labels.ship} ${momentum}`;
    }
    if (pace) {
      pace.textContent = `${research}% ${labels.research} · ${synthesis}% ${labels.synthesis} · ${action}% ${labels.action}`;
    }
    line?.setAttribute("d", curve);
    area?.setAttribute("d", `${curve} L640 232 L20 232Z`);
    marker?.setAttribute("x1", chart.markerX.toFixed(1));
    marker?.setAttribute("x2", chart.markerX.toFixed(1));
    dot?.setAttribute("cx", chart.markerX.toFixed(1));
    dot?.setAttribute("cy", markerY.toFixed(1));
    setBreakdown(demo, "[data-artifact-research]", research);
    setBreakdown(demo, "[data-artifact-synthesis]", synthesis);
    setBreakdown(demo, "[data-artifact-action]", action);
    setResultBar(demo, "[data-artifact-result-research]", research);
    setResultBar(demo, "[data-artifact-result-synthesis]", synthesis);
    setResultBar(demo, "[data-artifact-result-action]", action);
    if (resultBadge) {
      resultBadge.textContent = `${labels.ship} ${momentum}`;
    }
    if (announcement) {
      announcement.textContent = `${labels.research} ${research}%, ${labels.synthesis} ${synthesis}%, ${labels.action} ${action}%.`;
    }
  };

  slider.addEventListener("input", update);
  update();
}
