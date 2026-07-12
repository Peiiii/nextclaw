import type { ReactNode } from 'react';
import { AlertCircle, FileText } from 'lucide-react';
import type { DocBrowserCustomTabRenderers } from '@/shared/components/doc-browser/doc-browser-renderer.types';
import type {
  DocBrowserContextValue,
  DocBrowserRouteTarget,
} from '@/shared/components/doc-browser/types/doc-browser.types';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { t } from '@/shared/lib/i18n';
import { cn } from '@/shared/lib/utils';
import { useMarketplaceDetailDocEntry } from '@/features/marketplace/hooks/use-marketplace-detail-doc-entry';
import {
  setMarketplaceDetailDocEntry,
  type MarketplaceDetailDocEntry,
} from '@/features/marketplace/stores/marketplace-detail-doc.store';

export const MARKETPLACE_DETAIL_TAB_KIND = 'marketplace-detail';

type MetadataEntry = {
  key: string;
  value: string;
};

const DETAIL_URL_PREFIX = 'nextclaw://marketplace-detail';

export function createMarketplaceDetailDocId(scope: string, key: string): string {
  return `${scope}:${key}`;
}

export function createMarketplaceDetailDocUrl(detailId: string): string {
  return `${DETAIL_URL_PREFIX}/${encodeURIComponent(detailId)}`;
}

function readMarketplaceDetailDocId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'nextclaw:' || parsed.hostname !== 'marketplace-detail') {
      return null;
    }
    const rawId = parsed.pathname.replace(/^\//, '');
    return rawId ? decodeURIComponent(rawId) : null;
  } catch {
    return null;
  }
}

export function createMarketplaceDetailDocTarget(
  entry: MarketplaceDetailDocEntry,
): DocBrowserRouteTarget {
  const url = createMarketplaceDetailDocUrl(entry.id);
  return {
    dedupeKey: `marketplace-detail:${entry.id}`,
    historyPolicy: 'managed',
    kind: MARKETPLACE_DETAIL_TAB_KIND,
    resourceUri: url,
    title: entry.title,
    url,
  };
}

export function openMarketplaceDetailDoc(
  docBrowser: Pick<DocBrowserContextValue, 'openTarget'>,
  entry: MarketplaceDetailDocEntry,
  options?: { activate?: boolean },
): void {
  setMarketplaceDetailDocEntry(entry);
  docBrowser.openTarget(createMarketplaceDetailDocTarget(entry), {
    activate: options?.activate,
    dedupeKey: `marketplace-detail:${entry.id}`,
    title: entry.title,
  });
}

function stripYamlFrontmatter(text: string): string {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  if (lines[0]?.trim() !== '---') {
    return text;
  }
  const closingIndex = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
  return closingIndex > 0 ? lines.slice(closingIndex + 1).join('\n').trim() : text;
}

function renderInlineMarkdown(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const tokenPattern = /(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g;
  let cursor = 0;
  let index = 0;
  for (const match of text.matchAll(tokenPattern)) {
    if (match.index === undefined) {
      continue;
    }
    if (match.index > cursor) {
      nodes.push(text.slice(cursor, match.index));
    }
    const token = match[0];
    const key = `${index}-${match.index}`;
    if (token.startsWith('`')) {
      nodes.push(
        <code key={key} className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[0.88em] text-foreground">
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith('**')) {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else {
      const linkMatch = token.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/);
      nodes.push(
        linkMatch ? (
          <a key={key} href={linkMatch[2]} target="_blank" rel="noopener noreferrer">
            {linkMatch[1]}
          </a>
        ) : token,
      );
    }
    cursor = match.index + token.length;
    index += 1;
  }
  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }
  return nodes;
}

function isMarkdownBlockStart(line: string): boolean {
  return /^(#{1,4})\s+/.test(line)
    || /^([-*])\s+/.test(line)
    || /^\d+\.\s+/.test(line)
    || /^>\s?/.test(line)
    || /^```/.test(line);
}

function renderCodeBlock(lines: string[], index: number, fenceMatch: RegExpMatchArray) {
  const codeLines: string[] = [];
  let nextIndex = index + 1;
  while (nextIndex < lines.length && !lines[nextIndex]?.trim().startsWith('```')) {
    codeLines.push(lines[nextIndex] ?? '');
    nextIndex += 1;
  }
  const language = fenceMatch[1] ?? '';
  return {
    node: (
      <div key={index} className="relative my-3 overflow-hidden rounded-lg border border-border bg-muted/70">
        {language ? (
          <span className="absolute right-3 top-2 font-mono text-[10px] text-muted-foreground">
            {language}
          </span>
        ) : null}
        <pre className="m-0 overflow-x-auto p-3 text-xs leading-6 text-foreground">
          <code>{codeLines.join('\n')}</code>
        </pre>
      </div>
    ),
    nextIndex: nextIndex + 1,
  };
}

function renderListBlock(lines: string[], index: number, ordered: boolean) {
  const items: string[] = [];
  let nextIndex = index;
  const matcher = ordered ? /^\d+\.\s+/ : /^[-*]\s+/;
  while (nextIndex < lines.length && matcher.test(lines[nextIndex]?.trim() ?? '')) {
    items.push((lines[nextIndex] ?? '').trim().replace(matcher, ''));
    nextIndex += 1;
  }
  const Tag = ordered ? 'ol' : 'ul';
  return {
    node: (
      <Tag key={index} className={cn('my-2 pl-5', ordered ? 'list-decimal' : 'list-disc')}>
        {items.map((item, itemIndex) => (
          <li key={`${index}-${itemIndex}`} className="my-1">
            {renderInlineMarkdown(item)}
          </li>
        ))}
      </Tag>
    ),
    nextIndex,
  };
}

function renderHeadingNode(level: number, key: number, children: ReactNode[]) {
  const className = "mb-2 mt-5 font-semibold leading-tight text-foreground";
  if (level === 1) {
    return <h1 key={key} className={className}>{children}</h1>;
  }
  if (level === 2) {
    return <h2 key={key} className={className}>{children}</h2>;
  }
  if (level === 3) {
    return <h3 key={key} className={className}>{children}</h3>;
  }
  return <h4 key={key} className={className}>{children}</h4>;
}

function renderMarkdownBlock(lines: string[], index: number) {
  const trimmed = lines[index]?.trim() ?? '';
  const fenceMatch = trimmed.match(/^```(\S*)/);
  if (fenceMatch) {
    return renderCodeBlock(lines, index, fenceMatch);
  }
  const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
  if (headingMatch) {
    const level = Math.min(4, headingMatch[1]?.length ?? 2);
    return {
      node: renderHeadingNode(level, index, renderInlineMarkdown(headingMatch[2] ?? '')),
      nextIndex: index + 1,
    };
  }
  if (/^[-*]\s+/.test(trimmed)) {
    return renderListBlock(lines, index, false);
  }
  if (/^\d+\.\s+/.test(trimmed)) {
    return renderListBlock(lines, index, true);
  }
  if (/^>\s?/.test(trimmed)) {
    const quotes: string[] = [];
    let nextIndex = index;
    while (nextIndex < lines.length && /^>\s?/.test(lines[nextIndex]?.trim() ?? '')) {
      quotes.push((lines[nextIndex] ?? '').trim().replace(/^>\s?/, ''));
      nextIndex += 1;
    }
    return {
      node: (
        <blockquote key={index} className="my-3 rounded-lg border-l-4 border-primary/50 bg-muted/60 px-3 py-2 text-muted-foreground">
          {renderInlineMarkdown(quotes.join(' '))}
        </blockquote>
      ),
      nextIndex,
    };
  }

  const paragraphLines: string[] = [];
  let nextIndex = index;
  while (nextIndex < lines.length) {
    const paragraphLine = lines[nextIndex]?.trim() ?? '';
    if (!paragraphLine || isMarkdownBlockStart(paragraphLine)) {
      break;
    }
    paragraphLines.push(paragraphLine);
    nextIndex += 1;
  }
  return {
    node: <p key={index}>{renderInlineMarkdown(paragraphLines.join(' '))}</p>,
    nextIndex,
  };
}

function renderMarkdown(markdown: string): ReactNode[] {
  const lines = stripYamlFrontmatter(markdown).replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let index = 0;
  while (index < lines.length) {
    if (!(lines[index] ?? '').trim()) {
      index += 1;
      continue;
    }
    const result = renderMarkdownBlock(lines, index);
    blocks.push(result.node);
    index = result.nextIndex;
  }
  return blocks;
}

function stringifyMetadataValue(value: unknown): string {
  if (Array.isArray(value)) {
    const values = value
      .map((entry) => stringifyMetadataValue(entry))
      .filter((entry) => entry.trim().length > 0);
    return values.join(', ');
  }
  if (value && typeof value === 'object') {
    return '';
  }
  return String(value ?? '');
}

function readJsonMetadata(raw: string): MetadataEntry[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return [];
    }
    return Object.entries(parsed)
      .map(([key, value]) => ({ key, value: stringifyMetadataValue(value) }))
      .filter((entry) => entry.value.trim().length > 0);
  } catch {
    return [];
  }
}

function readYamlLikeMetadata(raw: string): MetadataEntry[] {
  return raw
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.match(/^([A-Za-z0-9_.-]+):\s*(.+)$/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => ({
      key: match[1] ?? '',
      value: match[2]?.replace(/^["']|["']$/g, '') ?? '',
    }))
    .filter((entry) => entry.key && entry.value.trim().length > 0);
}

function readMetadata(raw: string): MetadataEntry[] {
  const jsonEntries = readJsonMetadata(raw);
  return jsonEntries.length > 0 ? jsonEntries : readYamlLikeMetadata(raw);
}

function MarketplaceDetailSkeleton() {
  return (
    <div className="space-y-4 p-5">
      <section className="rounded-xl border border-border bg-card p-5">
        <Skeleton className="h-7 w-1/2" />
        <Skeleton className="mt-3 h-4 w-3/4" />
        <Skeleton className="mt-4 h-4 w-full" />
        <Skeleton className="mt-3 h-4 w-2/3" />
      </section>
      <section className="grid gap-4 lg:grid-cols-[minmax(220px,0.42fr)_minmax(0,1fr)]">
        <Skeleton className="h-56 rounded-xl" />
        <Skeleton className="h-56 rounded-xl" />
      </section>
    </div>
  );
}

function MetadataView({ raw }: { raw: string }) {
  const entries = readMetadata(raw);
  if (entries.length === 0) {
    return <pre className="m-0 whitespace-pre-wrap break-words font-mono text-xs leading-6">{raw}</pre>;
  }
  return (
    <dl className="m-0">
      {entries.map((entry) => (
        <div key={entry.key} className="grid grid-cols-[minmax(104px,0.34fr)_minmax(0,1fr)] gap-3 border-b border-border/70 py-2 last:border-b-0">
          <dt className="break-words font-semibold text-primary">{entry.key}</dt>
          <dd className="m-0 break-words text-card-foreground">{entry.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <h2 className="border-b border-border bg-muted/40 px-4 py-3 text-sm font-semibold text-card-foreground">
        {title}
      </h2>
      <div className="p-4 text-sm leading-7 text-card-foreground">{children}</div>
    </article>
  );
}

function MarketplaceDetailUnavailable() {
  return (
    <div className="flex h-full items-center justify-center bg-background p-6 text-center text-muted-foreground">
      <div className="max-w-sm">
        <AlertCircle className="mx-auto mb-3 h-7 w-7 text-muted-foreground" />
        <h2 className="text-base font-semibold text-foreground">{t('marketplaceDetailUnavailableTitle')}</h2>
        <p className="mt-2 text-sm leading-6">{t('marketplaceDetailUnavailableDescription')}</p>
      </div>
    </div>
  );
}

function MarketplaceDetailDocContent({ entry }: { entry: MarketplaceDetailDocEntry }) {
  const metadata = entry.metadataRaw?.trim() || '-';
  const content = entry.contentRaw?.trim() || '-';
  const summary = entry.summary?.trim();
  const description = entry.description?.trim();
  const shouldShowDescription = Boolean(description) && description !== summary;

  return (
    <main className="h-full overflow-auto bg-background text-foreground custom-scrollbar">
      <div className="mx-auto max-w-[940px] space-y-4 p-5 pb-9">
        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-primary">
              <FileText className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h1 className="break-words text-2xl font-semibold leading-tight text-foreground">{entry.title}</h1>
              <p className="mt-2 break-words text-xs text-muted-foreground">
                {entry.typeLabel} · {entry.spec}
                {entry.author ? ` · ${entry.author}` : ''}
              </p>
            </div>
          </div>
          {summary ? <p className="mt-4 text-sm leading-7 text-card-foreground">{summary}</p> : null}
          {shouldShowDescription ? <p className="mt-3 text-sm leading-7 text-card-foreground">{description}</p> : null}
          {entry.tags && entry.tags.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {entry.tags.map((tag) => (
                <span key={tag} className="rounded-full border border-border bg-muted px-3 py-1 text-xs text-muted-foreground">
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
          {entry.sourceUrl ? (
            <p className="mt-4 break-all text-xs text-muted-foreground">
              {entry.sourceLabel ?? t('marketplaceDetailSource')}: {' '}
              <a href={entry.sourceUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">
                {entry.sourceUrl}
              </a>
            </p>
          ) : null}
        </section>
        <section className="grid grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))] gap-4">
          <DetailSection title={t('marketplaceDetailMetadata')}>
            <MetadataView raw={metadata} />
          </DetailSection>
          <DetailSection title={t('marketplaceDetailContent')}>
            <div className="marketplace-detail-markdown space-y-3 text-sm leading-7 text-card-foreground [&_a]:font-medium [&_a]:text-primary [&_a:hover]:underline">
              {renderMarkdown(content)}
            </div>
          </DetailSection>
        </section>
      </div>
    </main>
  );
}

function MarketplaceDetailDoc({ currentUrl }: { currentUrl: string }) {
  const detailId = readMarketplaceDetailDocId(currentUrl);
  const entry = useMarketplaceDetailDocEntry(detailId);

  if (!detailId) {
    return <MarketplaceDetailUnavailable />;
  }
  if (!entry || entry.status === 'loading') {
    return <MarketplaceDetailSkeleton />;
  }
  if (entry.status === 'error' && !entry.contentRaw) {
    return <MarketplaceDetailUnavailable />;
  }
  return <MarketplaceDetailDocContent entry={entry} />;
}

export const MARKETPLACE_DETAIL_DOC_BROWSER_RENDERERS: DocBrowserCustomTabRenderers = {
  [MARKETPLACE_DETAIL_TAB_KIND]: {
    getTitle: (tab) => tab.title,
    renderContent: ({ currentUrl }) => <MarketplaceDetailDoc currentUrl={currentUrl} />,
    renderIcon: () => <FileText className="h-4 w-4 text-primary" />,
  },
};
