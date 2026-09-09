import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(await readFile(resolve(root, 'src/shared/lib/landing-content/landing-images.generated.json'), 'utf8'));
for (const [source, image] of Object.entries(manifest)) {
  assert(image.width > 0 && image.height > 0, `${source}: intrinsic dimensions`);
  assert(image.variants.length >= 2, `${source}: responsive candidates`);
  let last = 0;
  for (const variant of image.variants) {
    assert(variant.width > last && variant.width <= image.width, `${source}: sorted, non-upscaled widths`);
    last = variant.width;
    for (const format of ['avif', 'webp']) {
      assert.match(variant[format], new RegExp(`^/assets/screenshots/[a-f0-9]{16}\\.${format}$`));
      const path = resolve(root, 'public', variant[format].slice(1));
      const metadata = await sharp(path).metadata();
      assert.equal(metadata.width, variant.width, `${source}: actual candidate width`);
      assert((await stat(path)).size <= (variant.width <= 960 ? 250000 : 1000000), `${source}: ${format} byte budget`);
    }
  }
  assert((await stat(resolve(root, 'public', image.original.slice(1)))).size > 0, `${source}: original link`);
}
assert.match(await readFile(resolve(root, 'public/_headers'), 'utf8'), /\/assets\/\*[\s\S]*immutable/);
console.log(`PASS: ${Object.keys(manifest).length} screenshots; formats, widths, byte budgets, originals and immutable cache`);
