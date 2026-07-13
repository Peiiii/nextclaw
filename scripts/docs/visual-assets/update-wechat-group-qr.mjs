import { createHash } from 'node:crypto';
import path from 'node:path';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { resolveRepoPath } from '../../shared/repo-paths.mjs';

const repoRoot = resolveRepoPath(import.meta.url);
const landingRoutePath = resolveRepoPath(
  import.meta.url,
  'apps/landing/src/shared/lib/landing-content/landing-route.utils.ts'
);

function readOption(name) {
  const exactIndex = process.argv.indexOf(name);
  if (exactIndex >= 0) {
    return process.argv[exactIndex + 1];
  }
  const inline = process.argv.find((argument) => argument.startsWith(`${name}=`));
  return inline?.slice(name.length + 1);
}

function detectImageMime(buffer) {
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png';
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  throw new Error('source must be a valid PNG or JPEG image');
}

async function normalizePng(sourceBuffer, mime) {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: 1,
      colorScheme: 'light'
    });
    try {
      const page = await context.newPage();
      const dataUrl = `data:${mime};base64,${sourceBuffer.toString('base64')}`;
      await page.setContent(
        `<style>html,body{margin:0;background:#fff;line-height:0}img{display:block}</style><img id="source" src="${dataUrl}" alt="">`
      );
      const image = page.locator('#source');
      await image.waitFor({ state: 'visible' });
      const dimensions = await image.evaluate((element) => ({
        width: element.naturalWidth,
        height: element.naturalHeight
      }));
      if (dimensions.width < 300 || dimensions.height < 300) {
        throw new Error(`source image is too small: ${dimensions.width}x${dimensions.height}`);
      }
      if (mime === 'image/png') {
        return { buffer: sourceBuffer, dimensions };
      }
      await page.setViewportSize(dimensions);
      return {
        buffer: await image.screenshot({ type: 'png' }),
        dimensions
      };
    } finally {
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

async function writeAtomically(targetPath, contents) {
  await mkdir(path.dirname(targetPath), { recursive: true });
  const temporaryPath = `${targetPath}.tmp-${process.pid}`;
  await writeFile(temporaryPath, contents);
  await rename(temporaryPath, targetPath);
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function readInputOptions() {
  if (process.argv.includes('--help')) {
    console.log('Usage: pnpm run assets:update-wechat-qr -- --source <png-or-jpeg> --date YYYY-MM-DD');
    return null;
  }

  const source = readOption('--source');
  const date = readOption('--date');
  if (!source || !date) {
    throw new Error('both --source and --date are required');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`invalid --date value: ${date}`);
  }
  return { date, sourcePath: path.resolve(source) };
}

async function main() {
  const options = readInputOptions();
  if (!options) {
    return;
  }
  const { date, sourcePath } = options;

  const sourceBuffer = await readFile(sourcePath);
  const mime = detectImageMime(sourceBuffer);
  const normalized = await normalizePng(sourceBuffer, mime);
  const datedFileName = `nextclaw-contact-wechat-group-${date}.png`;
  const targetPaths = [
    resolveRepoPath(import.meta.url, 'images/contact/nextclaw-contact-wechat-group.png'),
    resolveRepoPath(import.meta.url, 'apps/landing/public/contact/nextclaw-contact-wechat-group.png'),
    resolveRepoPath(import.meta.url, `apps/landing/public/contact/${datedFileName}`)
  ];

  const routeSource = await readFile(landingRoutePath, 'utf8');
  const routePattern = /wechatGroupImage: '\/contact\/nextclaw-contact-wechat-group(?:-\d{4}-\d{2}-\d{2})?\.png'/;
  if (!routePattern.test(routeSource)) {
    throw new Error('landing WeChat group image reference was not found');
  }
  const updatedRouteSource = routeSource.replace(
    routePattern,
    `wechatGroupImage: '/contact/${datedFileName}'`
  );

  await Promise.all(targetPaths.map(async (targetPath) => writeAtomically(targetPath, normalized.buffer)));
  await writeAtomically(landingRoutePath, updatedRouteSource);

  const writtenBuffers = await Promise.all(targetPaths.map(async (targetPath) => readFile(targetPath)));
  const hashes = new Set(writtenBuffers.map(sha256));
  if (hashes.size !== 1) {
    throw new Error('written WeChat group assets do not have matching hashes');
  }

  console.log(`[wechat-qr] source=${sourcePath}`);
  console.log(`[wechat-qr] output=${normalized.dimensions.width}x${normalized.dimensions.height} png`);
  console.log(`[wechat-qr] sha256=${sha256(normalized.buffer)}`);
  for (const targetPath of targetPaths) {
    console.log(`[wechat-qr] updated ${path.relative(repoRoot, targetPath)}`);
  }
  console.log(`[wechat-qr] landing reference=/contact/${datedFileName}`);
}

await main().catch((error) => {
  console.error('[wechat-qr] failed:', error);
  process.exitCode = 1;
});
