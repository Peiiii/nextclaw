const DEFAULT_API_BASE = 'http://127.0.0.1:55667';

export const API_BASE = (() => {
  const envBase = import.meta.env.VITE_API_BASE?.trim();
  if (envBase) {
    return envBase.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return DEFAULT_API_BASE;
})();

if (import.meta.env.DEV && !import.meta.env.VITE_API_BASE) {
  console.warn('VITE_API_BASE is not set; falling back to window origin.');
}
