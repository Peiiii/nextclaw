import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const base = process.argv[2] ?? 'http://127.0.0.1:5196';
const directory = resolve(process.argv[3] ?? '.local/landing-measurements');
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    for (const locale of ['en', 'zh']) {
      const context = await browser.newContext({ viewport, deviceScaleFactor: viewport.width < 600 ? 2 : 1 });
      const page = await context.newPage();
      const client = await context.newCDPSession(page);
      await client.send('Network.enable');
      await client.send('Network.setCacheDisabled', { cacheDisabled: true });
      await client.send('Network.emulateNetworkConditions', { offline: false, latency: 100, downloadThroughput: 200000, uploadThroughput: 100000 });
      await page.addInitScript(() => {
        window.imageMetrics = { lcp: 0, cls: 0, lcpUrl: '' };
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            window.imageMetrics.lcp = entry.startTime;
            window.imageMetrics.lcpUrl = entry.url ?? '';
          }
        }).observe({ type: 'largest-contentful-paint', buffered: true });
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.imageMetrics.cls += entry.value;
        }).observe({ type: 'layout-shift', buffered: true });
      });
      await page.goto(`${base}/${locale}/`, { waitUntil: 'domcontentloaded', timeout: 90000 });
      await page.locator('.landing-hero__product-image').waitFor({ timeout: 90000 });
      await page.waitForFunction(() => document.querySelector('.landing-hero__product-image')?.complete, undefined, { timeout: 90000 });
      await page.waitForTimeout(5000);
      const metrics = await page.evaluate(() => {
        const resources = performance.getEntriesByType('resource').filter((entry) => entry.initiatorType === 'img');
        return { ...window.imageMetrics, imageCount: resources.length, imageBytes: resources.reduce((sum, entry) => sum + entry.encodedBodySize, 0),
          images: [...document.images].map((image) => ({ src: image.currentSrc, loading: image.loading, priority: image.fetchPriority, width: image.clientWidth, naturalWidth: image.naturalWidth })),
          resources: resources.map((entry) => ({ url: entry.name, bytes: entry.encodedBodySize, start: entry.startTime, duration: entry.duration })),
          overflow: document.documentElement.scrollWidth > innerWidth };
      });
      const name = `${locale}-${viewport.width}`;
      await page.screenshot({ path: resolve(directory, `${name}.png`) });
      results.push({ name, base, ...metrics });
      console.log(JSON.stringify({ name, lcp: metrics.lcp, cls: metrics.cls, imageBytes: metrics.imageBytes, imageCount: metrics.imageCount, overflow: metrics.overflow }));
      await context.close();
    }
  }
} finally { await browser.close(); }
await writeFile(resolve(directory, 'metrics.json'), `${JSON.stringify(results, null, 2)}\n`);
