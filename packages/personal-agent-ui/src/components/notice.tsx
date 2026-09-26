export function Notice({ tone, children, onDismiss }: { tone: "loading" | "success" | "error"; children: string; onDismiss?: () => void }) {
  const content = <>{children}{onDismiss && <span aria-hidden="true"> ×</span>}</>;
  if (onDismiss) return <div role={tone === "error" ? "alert" : "status"}><button className={`ui-notice ui-notice--${tone}`} type="button" onClick={onDismiss} aria-label={`${children}，关闭提示`}>{content}</button></div>;
  return <p className={`ui-notice ui-notice--${tone}`} role={tone === "error" ? "alert" : "status"}>{content}</p>;
}
