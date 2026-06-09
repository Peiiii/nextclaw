import serviceWorkerSource from '../../../../../public/sw.js?raw';

describe('NextClaw service worker cache policy', () => {
  it('does not precache the app shell entrypoint', () => {
    expect(serviceWorkerSource).not.toContain("'/'");
  });

  it('does not fall back to stale navigation responses', () => {
    expect(serviceWorkerSource).not.toContain("request.mode === 'navigate'");
    expect(serviceWorkerSource).not.toContain('handleNavigation');
    expect(serviceWorkerSource).toContain('SHELL_ASSETS.includes(url.pathname)');
  });

  it('does not force service worker activation or page control', () => {
    expect(serviceWorkerSource).not.toContain('skipWaiting');
    expect(serviceWorkerSource).not.toContain('clients.claim');
  });
});
