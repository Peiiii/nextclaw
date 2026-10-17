import { useCallback, useState } from "react";

/**
 * 账号登录开关：控制 NextClaw 账号登录入口（浏览器授权登录）是否可见。
 * 关闭后账号面板与登录管理页不再显示登录入口，但已登录会话不受影响。
 */

const ACCOUNT_LOGIN_ENABLED_KEY = "nextclaw.account-login.enabled";

export function isAccountLoginEnabled(): boolean {
  if (typeof window === "undefined") {
    return true;
  }
  try {
    const raw = window.localStorage.getItem(ACCOUNT_LOGIN_ENABLED_KEY);
    if (raw === null) {
      return true;
    }
    return raw === "true";
  } catch {
    return true;
  }
}

export function setAccountLoginEnabled(enabled: boolean): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(ACCOUNT_LOGIN_ENABLED_KEY, String(enabled));
  } catch {
    // ignore storage failures
  }
}

export function useAccountLoginEnabled(): {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
} {
  const [enabled, setEnabledState] = useState<boolean>(isAccountLoginEnabled);

  const setEnabled = useCallback((next: boolean) => {
    setAccountLoginEnabled(next);
    setEnabledState(next);
  }, []);

  return { enabled, setEnabled };
}
