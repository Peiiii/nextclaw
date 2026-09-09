import generated from './landing-images.generated.json';

type ImageAsset = {
  width: number; height: number; original: string;
  variants: { width: number; avif: string; webp: string }[];
};
const images: Record<string, ImageAsset> = generated;
const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function originalScreenshot(source: string): string {
  const image = images[source];
  if (!image) throw new Error(`Screenshot missing from generated manifest: ${source}`);
  return image.original;
}

export function screenshotPoster(source: string): string {
  const image = images[source];
  if (!image) throw new Error(`Screenshot missing from generated manifest: ${source}`);
  return (image.variants.find((item) => item.width >= 1440) ?? image.variants[image.variants.length - 1]).webp;
}

export function renderScreenshot(source: string, alt: string, options: {
  className?: string; hero?: boolean; sizes?: string;
} = {}): string {
  const image = images[source];
  if (!image) throw new Error(`Screenshot missing from generated manifest: ${source}`);
  const sizes = options.sizes ?? '(min-width: 1280px) 720px, (min-width: 960px) 58vw, calc(100vw - 48px)';
  const srcset = (format: 'avif' | 'webp') => image.variants.map((item) => `${item[format]} ${item.width}w`).join(', ');
  const fallback = image.variants.find((item) => item.width >= 960) ?? image.variants[image.variants.length - 1];
  return `<picture style="display:contents">
    <source type="image/avif" srcset="${srcset('avif')}" sizes="${escape(sizes)}">
    <source type="image/webp" srcset="${srcset('webp')}" sizes="${escape(sizes)}">
    <img src="${fallback.webp}" srcset="${srcset('webp')}" sizes="${escape(sizes)}"
      width="${image.width}" height="${image.height}" alt="${escape(alt)}" class="${escape(options.className ?? '')}"
      loading="${options.hero ? 'eager' : 'lazy'}" decoding="async"${options.hero ? ' fetchpriority="high"' : ''}>
  </picture>`;
}
