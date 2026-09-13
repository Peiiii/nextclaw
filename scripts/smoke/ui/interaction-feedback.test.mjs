import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chromium } from 'playwright';

// Run against a source UI server: NEXTCLAW_UI_URL=http://127.0.0.1:5186 node --test scripts/smoke/ui/interaction-feedback.test.mjs
const baseUrl = process.env.NEXTCLAW_UI_URL ?? 'http://127.0.0.1:5186';
const themes = ['work', 'natural', 'minimal', 'warm', 'cool', 'dawn', 'graphite', 'night', 'charcoal', 'island', 'probe'];

async function readFeedback(button) {
  return button.evaluate(element => {
    const layer = getComputedStyle(element, '::before');
    let parent = element.parentElement;
    while (parent && getComputedStyle(parent).backgroundColor === 'rgba(0, 0, 0, 0)') parent = parent.parentElement;
    return {
      hovered: element.matches(':hover'),
      color: layer.backgroundColor,
      opacity: Number(layer.opacity),
      width: parseFloat(layer.width),
      height: parseFloat(layer.height),
      background: getComputedStyle(parent).backgroundColor,
    };
  });
}

function visibleDelta({ color, background, opacity }) {
  const ink = color.match(/[\d.]+/g).map(Number);
  const surface = background.match(/[\d.]+/g).map(Number);
  const alpha = (ink[3] ?? 1) * opacity;
  return Math.max(...surface.slice(0, 3).map((channel, index) => Math.abs(ink[index] - channel) * alpha));
}

test('shared icon feedback remains visible on the sidebar in every theme', async t => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const theme of themes) {
      await t.test(theme, async () => {
        const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
        try {
          await context.addInitScript(value => localStorage.setItem('nextclaw.ui.theme', value), theme);
          const page = await context.newPage();
          await page.goto(`${baseUrl}/chat`);
          const search = page.getByRole('button', { name: /^(搜索对话\.\.\.|Search conversations\.\.\.)$/ });
          await search.waitFor();
          await page.getByRole('button', { name: /^(项目|Project)$/ }).click();
          const add = page.getByRole('button', { name: /^(新增项目|添加项目|Add Project)$/ });
          for (const button of [search, add]) {
            await page.mouse.move(900, 100);
            await page.waitForTimeout(200); // Allow the CSS transition to finish.
            const idle = await readFeedback(button);
            await button.hover();
            await page.waitForTimeout(200);
            const hovered = await readFeedback(button);
            assert.ok(hovered.hovered && hovered.width > 0 && hovered.height > 0);
            assert.ok(visibleDelta(hovered) >= 6, `${theme}: invisible feedback ${JSON.stringify(hovered)}`);
            assert.ok(visibleDelta(hovered) > visibleDelta(idle), `${theme}: hover does not change the rendered surface`);
          }
        } finally {
          await context.close();
        }
      });
    }
  } finally {
    await browser.close();
  }
});
