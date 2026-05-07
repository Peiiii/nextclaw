import serviceWorkerSource from '../../../../public/sw.js?raw';

describe('NextClaw service worker cache policy', () => {
  it('does not precache the app shell entrypoint', () => {
    expect(serviceWorkerSource).not.toContain("'/'");
  });

  it('does not fall back to stale navigation responses', () => {
    const navigationHandler = serviceWorkerSource.slice(
      serviceWorkerSource.indexOf('async function handleNavigation'),
      serviceWorkerSource.indexOf('async function handleStaticAsset')
    );

    expect(navigationHandler).not.toContain('caches.match(request)');
  });
});
