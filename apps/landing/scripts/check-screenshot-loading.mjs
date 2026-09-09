import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = process.argv[2] ?? "http://127.0.0.1:5198";
const browser = await chromium.launch({ headless: true });
const cases = [1440, 390].flatMap((width) =>
  ["en", "zh"].flatMap((locale) =>
    ["", "use-cases/", "integrations/"].map((route) => ({
      width,
      locale,
      route,
    })),
  ),
);
try {
  for (const { width, locale, route } of cases) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      deviceScaleFactor: width < 600 ? 2 : 1,
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${base}/${locale}/${route}`);
    const images = page.locator("picture img");
    assert.equal(
      (await images.count()) > 0,
      route !== "use-cases/",
      "expected screenshot-bearing routes",
    );
    const initial = await page.evaluate(() => ({
      high: document.querySelectorAll('img[fetchpriority="high"]').length,
      raw: [...document.images].filter((image) =>
        /^(\/screenshots)?\/nextclaw-.*\.(png|jpg|webp)$/.test(
          new URL(image.src).pathname,
        ),
      ).length,
      videoStarted: [...document.querySelectorAll("video")].some(
        (video) => !!video.getAttribute("src"),
      ),
    }));
    assert.equal(
      initial.high,
      route ? 0 : 1,
      "only home Hero has high priority",
    );
    assert.equal(initial.raw, 0, "no default unoptimized screenshot URLs");
    assert.equal(
      initial.videoStarted,
      false,
      "below-fold video does not request on initial view",
    );
    for (const image of await images.all()) {
      if (await image.locator("xpath=ancestor::video").count()) continue;
      await image.scrollIntoViewIfNeeded();
      await image.evaluate((element) => element.decode());
      const result = await image.evaluate((element) => ({
        source: element.currentSrc,
        loading: element.loading,
        decoding: element.decoding,
        hero: element.fetchPriority === "high",
        width: element.getAttribute("width"),
        height: element.getAttribute("height"),
        parent: element.parentElement.tagName,
      }));
      assert.match(result.source, /\/assets\/screenshots\/[a-f0-9]{16}\.avif$/);
      assert.equal(result.loading, result.hero ? "eager" : "lazy");
      assert.equal(result.decoding, "async");
      assert(Number(result.width) > 0 && Number(result.height) > 0);
      assert.equal(result.parent, "PICTURE");
    }
    const video = page.locator("video");
    if (await video.count()) {
      await video.scrollIntoViewIfNeeded();
      await page.waitForFunction(
        () => document.querySelector("video")?.readyState >= 2,
      );
      assert(await video.evaluate((element) => element.videoWidth > 0));
    }
    const original = page.locator('a[href^="/assets/screenshots/"]').first();
    if (await original.count()) {
      const response = await context.request.get(
        `${base}${await original.getAttribute("href")}`,
      );
      assert(response.ok(), "original link is available");
      assert.match(response.headers()["content-type"], /^image\//);
    }
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      "no horizontal overflow",
    );
    assert.deepEqual(errors, [], "no page errors");
    console.log(
      `PASS ${width}px /${locale}/${route}: ${await images.count()} responsive images, lazy media and original link`,
    );
    await page.close();
    await context.close();
  }
} finally {
  await browser.close();
}
