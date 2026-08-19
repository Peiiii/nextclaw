import { AppWindow } from "lucide-react";
import { cn } from "@/shared/lib/utils";

export function PanelAppIcon({
  className,
  icon,
  imageClassName,
  title,
}: {
  className?: string;
  icon?: string;
  imageClassName?: string;
  title: string;
}) {
  const normalizedIcon = icon?.trim();
  if (!normalizedIcon) {
    return <AppWindow className={cn("h-4 w-4", className)} />;
  }
  if (isPanelAppImageIcon(normalizedIcon)) {
    return (
      <img
        src={normalizedIcon}
        alt=""
        aria-hidden="true"
        className={cn("h-5 w-5 rounded-sm object-contain", imageClassName, className)}
        title={title}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn("max-w-6 truncate text-center leading-none", className)}
      title={title}
    >
      {normalizedIcon}
    </span>
  );
}

export function isPanelAppImageIcon(icon: string): boolean {
  return (
    icon.startsWith("data:image/") ||
    icon.startsWith("http://") ||
    icon.startsWith("https://") ||
    icon.startsWith("/")
  );
}
