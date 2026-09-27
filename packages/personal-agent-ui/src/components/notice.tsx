import { X } from "lucide-react";
import { IconButton } from "./icon-button";

export function Notice({ tone, children, onDismiss }: { tone: "loading" | "success" | "error"; children: string; onDismiss?: () => void }) {
  return <div className={`ui-notice ui-notice--${tone}`} role={tone === "error" ? "alert" : "status"}>
    <span>{children}</span>
    {onDismiss && <IconButton label="关闭提示" icon={<X />} tooltip={false} onClick={onDismiss} />}
  </div>;
}
