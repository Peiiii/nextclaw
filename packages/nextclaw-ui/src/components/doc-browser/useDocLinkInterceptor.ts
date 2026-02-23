import { useEffect } from 'react';
import { isDocsUrl, useDocBrowser } from './DocBrowserContext';

/**
 * Global click interceptor for docs links.
 * Captures clicks on <a> tags pointing to the docs domain
 * and opens them in the in-app micro-browser instead.
 */
export function useDocLinkInterceptor() {
    const docBrowser = useDocBrowser();

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            // Walk up from the click target to find an anchor
            const anchor = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href]');
            if (!anchor) return;

            const href = anchor.getAttribute('href') || '';
            if (!isDocsUrl(href)) return;

            // Don't intercept links explicitly marked for external opening
            if (anchor.hasAttribute('data-doc-external')) return;

            // Don't intercept if modifier keys are held (user wants new tab behavior)
            if (e.ctrlKey || e.metaKey || e.shiftKey) return;

            e.preventDefault();
            e.stopPropagation();
            docBrowser.open(href);
        };

        // Use capture phase to intercept before React's synthetic events
        document.addEventListener('click', handler, true);
        return () => document.removeEventListener('click', handler, true);
    }, [docBrowser]);
}
