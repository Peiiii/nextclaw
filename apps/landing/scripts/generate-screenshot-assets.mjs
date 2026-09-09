import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, readdir, stat, copyFile } from 'node:fs/promises';
import { dirname, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'public/assets/screenshots');
const manifestPath = resolve(root, 'src/shared/lib/landing-content/landing-images.generated.json');
const widths = [640, 960, 1440, 1920, 2560];
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex').slice(0, 16);

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => entry.isDirectory()
    ? sourceFiles(resolve(directory, entry.name))
    : entry.name.endsWith('.ts') ? [resolve(directory, entry.name)] : []));
  return nested.flat();
}

async function writeAsset(bytes, suffix) {
  const name = `${hash(bytes)}${suffix}`;
  await writeFile(resolve(output, name), bytes);
  return `/assets/screenshots/${name}`;
}

async function generate(source) {
  const path = source.startsWith('/screenshots/')
    ? resolve(root, '../../images', source.slice(1)) : resolve(root, 'public', source.slice(1));
  const bytes = await readFile(path);
  const { width, height } = await sharp(bytes).metadata();
  if (!width || !height) throw new Error(`Missing dimensions: ${source}`);
  const fingerprint = hash(Buffer.concat([bytes, Buffer.from(`v1:${sharp.versions.sharp}:${widths}:avif65:webp85`)]));
  const cachePath = resolve(output, `${fingerprint}.json`);
  try {
    const cached = JSON.parse(await readFile(cachePath, 'utf8'));
    const assets = [cached.original, ...cached.variants.flatMap((variant) => [variant.avif, variant.webp])];
    await Promise.all(assets.map((asset) => stat(resolve(root, 'public', asset.slice(1)))));
    return cached;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const sizes = [...new Set([...widths.filter((candidate) => candidate < width), Math.min(width, 3024)])].sort((a, b) => a - b);
  const variants = [];
  for (const size of sizes) {
    const pipeline = sharp(bytes).resize({ width: size, withoutEnlargement: true });
    const avif = await pipeline.clone().avif({ quality: 65, effort: 3, chromaSubsampling: '4:4:4' }).toBuffer();
    const webp = await pipeline.clone().webp({ quality: 85, effort: 4, smartSubsample: true }).toBuffer();
    variants.push({ width: size, avif: await writeAsset(avif, '.avif'), webp: await writeAsset(webp, '.webp'), avifBytes: avif.length, webpBytes: webp.length });
  }
  const original = `/assets/screenshots/${hash(bytes)}${extname(path)}`;
  await copyFile(path, resolve(root, 'public', original.slice(1)));
  const result = { width, height, original, sourceBytes: bytes.length, variants };
  await writeFile(cachePath, JSON.stringify(result));
  return result;
}

await mkdir(output, { recursive: true });
const sources = new Set();
for (const file of await sourceFiles(resolve(root, 'src'))) {
  for (const match of (await readFile(file, 'utf8')).matchAll(/['"](\/(?:screenshots\/)?nextclaw-[^'"\s]+\.(?:png|jpg|webp))['"]/g)) sources.add(match[1]);
}
const manifest = {};
for (const source of [...sources].sort()) {
  manifest[source] = await generate(source);
  process.stdout.write(`Optimized ${source}\n`);
}
if (sources.size < 20) throw new Error(`Screenshot discovery unexpectedly found only ${sources.size} sources`);
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
const bytes = (await stat(manifestPath)).size;
process.stdout.write(`${sources.size} screenshots; manifest ${bytes} bytes\n`);
