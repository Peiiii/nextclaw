import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

const DOCS_PRIMARY_DOMAIN = 'docs.nextclaw.io';
const DOCS_FALLBACK_DOMAIN = 'nextclaw-docs.pages.dev';
const DOCS_HOSTS = new Set([
    DOCS_PRIMARY_DOMAIN,
    `www.${DOCS_PRIMARY_DOMAIN}`,
    DOCS_FALLBACK_DOMAIN,
    `www.${DOCS_FALLBACK_DOMAIN}`,
]);

export const DOCS_DEFAULT_BASE_URL = `https://${DOCS_FALLBACK_DOMAIN}`;

export type DocBrowserMode = 'floating' | 'docked';

interface DocBrowserState {
    isOpen: boolean;
    mode: DocBrowserMode;
    currentUrl: string;
    history: string[];
    historyIndex: number;
}

interface DocBrowserActions {
    open: (url?: string) => void;
    close: () => void;
    toggleMode: () => void;
    setMode: (mode: DocBrowserMode) => void;
    navigate: (url: string) => void;
    goBack: () => void;
    goForward: () => void;
    canGoBack: boolean;
    canGoForward: boolean;
}

type DocBrowserContextValue = DocBrowserState & DocBrowserActions;

const DocBrowserContext = createContext<DocBrowserContextValue | null>(null);

export function useDocBrowser(): DocBrowserContextValue {
    const ctx = useContext(DocBrowserContext);
    if (!ctx) throw new Error('useDocBrowser must be used within DocBrowserProvider');
    return ctx;
}

/** Check if a URL belongs to the docs domain */
export function isDocsUrl(url: string): boolean {
    try {
        const parsed = new URL(url, window.location.origin);
        return DOCS_HOSTS.has(parsed.hostname);
    } catch {
        return false;
    }
}

export function DocBrowserProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<DocBrowserState>({
        isOpen: false,
        mode: 'docked',
        currentUrl: `${DOCS_DEFAULT_BASE_URL}/guide/getting-started`,
        history: [`${DOCS_DEFAULT_BASE_URL}/guide/getting-started`],
        historyIndex: 0,
    });

    const open = useCallback((url?: string) => {
        const targetUrl = url || state.currentUrl || `${DOCS_DEFAULT_BASE_URL}/guide/getting-started`;
        setState(prev => ({
            ...prev,
            isOpen: true,
            currentUrl: targetUrl,
            history: [...prev.history.slice(0, prev.historyIndex + 1), targetUrl],
            historyIndex: prev.historyIndex + 1,
        }));
    }, [state.currentUrl]);

    const close = useCallback(() => {
        setState(prev => ({ ...prev, isOpen: false }));
    }, []);

    const toggleMode = useCallback(() => {
        setState(prev => ({ ...prev, mode: prev.mode === 'floating' ? 'docked' : 'floating' }));
    }, []);

    const setMode = useCallback((mode: DocBrowserMode) => {
        setState(prev => ({ ...prev, mode }));
    }, []);

    const navigate = useCallback((url: string) => {
        setState(prev => {
            // Normalize URLs for comparison (strip trailing slash, .html suffix)
            const normalize = (u: string) => {
                try { return new URL(u).pathname.replace(/\.html$/, '').replace(/\/$/, ''); } catch { return u; }
            };
            // Skip if same as current URL (prevents loop from postMessage echo)
            if (normalize(url) === normalize(prev.currentUrl)) return prev;
            return {
                ...prev,
                currentUrl: url,
                history: [...prev.history.slice(0, prev.historyIndex + 1), url],
                historyIndex: prev.historyIndex + 1,
            };
        });
    }, []);

    const goBack = useCallback(() => {
        setState(prev => {
            if (prev.historyIndex <= 0) return prev;
            const newIndex = prev.historyIndex - 1;
            return { ...prev, historyIndex: newIndex, currentUrl: prev.history[newIndex] };
        });
    }, []);

    const goForward = useCallback(() => {
        setState(prev => {
            if (prev.historyIndex >= prev.history.length - 1) return prev;
            const newIndex = prev.historyIndex + 1;
            return { ...prev, historyIndex: newIndex, currentUrl: prev.history[newIndex] };
        });
    }, []);

    const canGoBack = state.historyIndex > 0;
    const canGoForward = state.historyIndex < state.history.length - 1;

    const value = useMemo<DocBrowserContextValue>(() => ({
        ...state,
        open,
        close,
        toggleMode,
        setMode,
        navigate,
        goBack,
        goForward,
        canGoBack,
        canGoForward,
    }), [state, open, close, toggleMode, setMode, navigate, goBack, goForward, canGoBack, canGoForward]);

    return (
        <DocBrowserContext.Provider value={value}>
            {children}
        </DocBrowserContext.Provider>
    );
}
