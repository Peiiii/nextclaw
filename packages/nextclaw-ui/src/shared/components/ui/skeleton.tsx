import { cn } from "@/shared/lib/utils";

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn("motion-safe:animate-pulse rounded-md bg-foreground/[0.06]", className)}
      {...props}
    />
  );
}

function SkeletonContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex items-start gap-3 py-5", className)} aria-hidden="true" {...props}>
      <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1 space-y-3 pt-1">
        <Skeleton className="h-3.5 w-28 max-w-[55%]" />
        <Skeleton className="h-2.5 w-3/4 max-w-72" />
        <Skeleton className="h-2.5 w-1/2 max-w-48" />
      </div>
    </div>
  );
}

export { Skeleton, SkeletonContent };
