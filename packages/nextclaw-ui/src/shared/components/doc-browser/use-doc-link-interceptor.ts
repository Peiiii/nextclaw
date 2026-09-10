import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppPresenter } from '@/app/components/app-presenter-provider';
import { isDocsUrl } from './doc-browser-context';
import { toast } from 'sonner';
import { t } from '@/shared/lib/i18n';

/** Resource links use the same opening policy as navigation and page menus. */
export function useDocLinkInterceptor() {
  const app = useAppPresenter();
  const navigate = useNavigate();
  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
      if (!anchor || anchor.hasAttribute('data-doc-external') || anchor.hasAttribute('download')) return;
      const href = anchor.getAttribute('href') ?? '';
      if (!href.startsWith('nextclaw://') && !isDocsUrl(href)) return;
      event.preventDefault();
      event.stopPropagation();
      const origin = anchor.closest<HTMLElement>('[data-resource-session]');
      const page = app.pageResourceManager.resolve(href, { workingDir: origin?.dataset.resourceWorkingDir, sessionKey: origin?.dataset.resourceSession });
      if (page) {
        const label = anchor.cloneNode(true) as HTMLAnchorElement;
        label.querySelectorAll('[aria-hidden="true"]').forEach((element) => element.remove());
        const title = label.textContent?.trim();
        app.pageResourceManager.open(title ? { ...page, title, target: { ...page.target, title } } : page, 'default', navigate);
      }
      else toast.error(t('pageUnavailable'));
    };
    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, [app, navigate]);
}
