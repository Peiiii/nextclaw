export const PANEL_APP_IFRAME_SANDBOX = 'allow-scripts allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-downloads allow-pointer-lock allow-presentation';

export function focusPanelAppIframe(iframe: HTMLIFrameElement | null): void {
  iframe?.focus({ preventScroll: true });
  iframe?.contentWindow?.focus();
}
