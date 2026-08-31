import type { ReactNode } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";

export function ProjectSection({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card hover={false} surface="flat" className={className}>
      <CardHeader className="p-4 pb-3">
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">{children}</CardContent>
    </Card>
  );
}

export function ProjectEmptyState({ children }: { children: ReactNode }) {
  return <p className="py-5 text-sm text-muted-foreground">{children}</p>;
}

export function ProjectFilePreviewButton({
  available,
  children,
  className,
  label,
  onOpen,
  path,
}: {
  available: boolean;
  children: ReactNode;
  className: string;
  label: string;
  onOpen: (path: string, label: string) => void;
  path: string;
}) {
  if (!available) {
    return <div className={className}>{children}</div>;
  }
  return (
    <button
      type="button"
      className={className}
      title={path}
      onClick={() => onOpen(path, label)}
    >
      {children}
    </button>
  );
}
