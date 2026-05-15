import { cn } from "@/shared/lib/utils";

const MARKETPLACE_ITEM_ICON_COLORS = [
  "bg-amber-600",
  "bg-orange-500",
  "bg-yellow-600",
  "bg-emerald-600",
  "bg-teal-600",
  "bg-cyan-600",
  "bg-stone-600",
  "bg-rose-500",
  "bg-violet-500",
] as const;

export function MarketplaceItemIcon(props: {
  name?: string;
  fallback: string;
  className?: string;
}) {
  const { name, fallback, className } = props;
  const displayName = name || fallback;
  const letters = displayName.substring(0, 2).toUpperCase();

  return (
    <div
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-semibold text-white",
        getMarketplaceItemIconColor(displayName),
        className,
      )}
    >
      {letters}
    </div>
  );
}

function getMarketplaceItemIconColor(text: string) {
  let hash = 0;
  for (let index = 0; index < text.length; index++) {
    hash = text.charCodeAt(index) + ((hash << 5) - hash);
  }
  return MARKETPLACE_ITEM_ICON_COLORS[
    Math.abs(hash) % MARKETPLACE_ITEM_ICON_COLORS.length
  ];
}
