/* global chrome, FileReader, OffscreenCanvas, createImageBitmap */

export async function capturePageScreenshot(tab, options, runPageAction) {
  const { clip, fullPage, includeDataUrl } = options;
  const dataUrl = fullPage
    ? await captureFullPage(tab, runPageAction)
    : await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
  const clippedDataUrl = clip ? await cropImageDataUrl(dataUrl, clip) : dataUrl;
  return {
    dataUrl: includeDataUrl ? clippedDataUrl : undefined,
    mimeType: "image/png",
    fullPage,
    clip,
  };
}

async function captureFullPage(tab, runPageAction) {
  const metrics = await runPageAction("metrics", {}, "page.screenshot metrics");
  const bitmaps = [];
  const stepY = Math.max(1, metrics.viewportHeight);

  for (let y = 0; y < metrics.documentHeight; y += stepY) {
    await runPageAction("scroll-to", { x: 0, y }, "page.screenshot scroll");
    await sleep(750);
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
    bitmaps.push({ y, bitmap: await dataUrlToImageBitmap(dataUrl) });
  }

  await runPageAction("scroll-to", { x: metrics.scrollX, y: metrics.scrollY }, "page.screenshot restore scroll");

  if (bitmaps.length === 0) {
    return chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
  }

  const ratio = bitmaps[0].bitmap.width / metrics.viewportWidth;
  const canvas = new OffscreenCanvas(
    Math.ceil(metrics.documentWidth * ratio),
    Math.ceil(metrics.documentHeight * ratio),
  );
  const context = canvas.getContext("2d");
  for (const item of bitmaps) {
    context.drawImage(item.bitmap, 0, Math.round(item.y * ratio));
  }
  return canvasToDataUrl(canvas);
}

async function cropImageDataUrl(dataUrl, clip) {
  const bitmap = await dataUrlToImageBitmap(dataUrl);
  const canvas = new OffscreenCanvas(Number(clip.width), Number(clip.height));
  const context = canvas.getContext("2d");
  context.drawImage(
    bitmap,
    Number(clip.x),
    Number(clip.y),
    Number(clip.width),
    Number(clip.height),
    0,
    0,
    Number(clip.width),
    Number(clip.height),
  );
  return canvasToDataUrl(canvas);
}

async function dataUrlToImageBitmap(dataUrl) {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return createImageBitmap(blob);
}

async function canvasToDataUrl(canvas) {
  const blob = await canvas.convertToBlob({ type: "image/png" });
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}

function sleep(timeoutMs) {
  return new Promise((resolve) => setTimeout(resolve, timeoutMs));
}
