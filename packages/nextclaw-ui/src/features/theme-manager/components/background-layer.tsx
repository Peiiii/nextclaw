import { cn } from '@/shared/lib/utils';
import { useThemeManagerStore } from '@/features/theme-manager/managers/background-image.manager';

/**
 * 应用级主题背景图层。
 * - 渲染在 App Shell 内容层之下，作为整体氛围背景。
 * - 未选择背景图（url 为空）时不渲染，保持原有纯色底。
 * - 渐变类背景以完整形式呈现；图片类背景低透明度叠加，避免影响内容可读性。
 */
export function ThemeBackgroundLayer({
  className,
}: {
  className?: string;
}) {
  const currentBackground = useThemeManagerStore((state) => state.currentBackground);
  const url = currentBackground.url?.trim();
  if (!url) {
    return null;
  }
  const isGradient = url.includes('gradient');
  return (
    <div
      aria-hidden="true"
      data-theme-decoration="background-layer"
      className={cn('pointer-events-none absolute inset-0', className)}
      style={
        isGradient
          ? { background: url }
          : {
              backgroundImage: `url(${url})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              opacity: 0.2,
            }
      }
    />
  );
}
