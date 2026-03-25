import type { ChatComposerNode, ChatComposerSelection } from '../../view-models/chat-ui.types';
import { isChatComposerSelectionInsideRange } from './chat-composer.utils';

type RenderParams = {
  nodes: ChatComposerNode[];
  selectedRange: ChatComposerSelection | null;
  nodeStartMap: Map<string, number>;
};

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

export class ChatComposerSurfaceRenderer {
  render = (root: HTMLDivElement | null, params: RenderParams): void => {
    if (!root) {
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const node of params.nodes) {
      const element = node.type === 'text'
        ? this.createTextNodeElement(node)
        : this.createTokenNodeElement(node, params.selectedRange, params.nodeStartMap);

      if (element) {
        fragment.appendChild(element);
      }
    }

    root.replaceChildren(fragment);
  };

  private readonly createTextNodeElement = (node: Extract<ChatComposerNode, { type: 'text' }>): HTMLSpanElement | null => {
    if (node.text.length === 0) {
      return null;
    }

    const element = document.createElement('span');
    element.dataset.composerNodeId = node.id;
    element.dataset.composerNodeType = 'text';
    element.textContent = node.text;
    return element;
  };

  private readonly createTokenNodeElement = (
    node: Extract<ChatComposerNode, { type: 'token' }>,
    selectedRange: ChatComposerSelection | null,
    nodeStartMap: Map<string, number>
  ): HTMLSpanElement => {
    const nodeStart = nodeStartMap.get(node.id) ?? 0;
    const isSelected = isChatComposerSelectionInsideRange(selectedRange, nodeStart, nodeStart + 1);
    const element = document.createElement('span');

    element.contentEditable = 'false';
    element.dataset.composerNodeId = node.id;
    element.dataset.composerNodeType = 'token';
    element.dataset.composerTokenKind = node.tokenKind;
    element.dataset.composerTokenKey = node.tokenKey;
    element.dataset.composerLabel = node.label;
    element.title = node.label;
    element.className = this.buildTokenClassName(node.tokenKind, isSelected);

    element.append(this.createTokenIcon(node.tokenKind));

    const label = document.createElement('span');
    label.className = node.tokenKind === 'file' ? 'min-w-0 flex-1 truncate text-[12px] font-medium text-slate-800' : 'truncate';
    label.textContent = node.label;
    element.append(label);

    if (node.tokenKind === 'file') {
      const badge = document.createElement('span');
      badge.className = [
        'hidden',
        'shrink-0',
        'rounded-md',
        'border',
        'border-sky-100',
        'bg-sky-50',
        'px-1.5',
        'py-0.5',
        'text-[9px]',
        'font-semibold',
        'uppercase',
        'tracking-[0.12em]',
        'text-sky-700',
        'sm:inline-flex'
      ].join(' ');
      badge.textContent = this.resolveFileBadgeLabel(node.label);
      element.append(badge);
    }

    return element;
  };

  private readonly buildTokenClassName = (
    tokenKind: 'skill' | 'file',
    isSelected: boolean
  ): string => {
    if (tokenKind === 'file') {
      return [
        'mx-[2px]',
        'inline-flex',
        'h-8',
        'max-w-[min(100%,19rem)]',
        'items-center',
        'gap-2',
        'rounded-xl',
        'border',
        'px-2',
        'pr-2.5',
        'align-baseline',
        'shadow-[0_1px_2px_rgba(15,23,42,0.06)]',
        'transition-[border-color,background-color,box-shadow,color]',
        'duration-150',
        isSelected
          ? 'border-sky-300 bg-sky-50 text-slate-900 shadow-[0_0_0_3px_rgba(14,165,233,0.14)]'
          : 'border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(248,250,252,0.98))] text-slate-700'
      ].join(' ');
    }

    return [
      'mx-[2px]',
      'inline-flex',
      'h-7',
      'max-w-full',
      'items-center',
      'gap-1.5',
      'rounded-lg',
      'border',
      'px-2',
      'align-baseline',
      'text-[11px]',
      'font-medium',
      'transition',
      isSelected
        ? 'border-primary/30 bg-primary/18 text-primary'
        : 'border-primary/12 bg-primary/8 text-primary'
    ].join(' ');
  };

  private readonly createTokenIcon = (tokenKind: 'skill' | 'file'): HTMLElement => {
    const wrapper = document.createElement('span');
    wrapper.className = tokenKind === 'file'
      ? 'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-700'
      : 'inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center text-primary/70';
    wrapper.append(tokenKind === 'file' ? this.createFileIcon() : this.createSkillIcon());
    return wrapper;
  };

  private readonly createSkillIcon = (): SVGSVGElement => {
    return this.createSvgIcon([
      { tag: 'path', attrs: { d: 'M8.5 2.75 2.75 6l5.75 3.25L14.25 6 8.5 2.75Z' } },
      { tag: 'path', attrs: { d: 'M2.75 10 8.5 13.25 14.25 10' } },
      { tag: 'path', attrs: { d: 'M2.75 6v4l5.75 3.25V9.25L2.75 6Z' } },
      { tag: 'path', attrs: { d: 'M14.25 6v4L8.5 13.25V9.25L14.25 6Z' } }
    ]);
  };

  private readonly createFileIcon = (): SVGSVGElement => {
    return this.createSvgIcon([
      { tag: 'path', attrs: { d: 'M3.25 4.25A1.5 1.5 0 0 1 4.75 2.75h6.5a1.5 1.5 0 0 1 1.5 1.5v7.5a1.5 1.5 0 0 1-1.5 1.5h-6.5a1.5 1.5 0 0 1-1.5-1.5v-7.5Z' } },
      { tag: 'path', attrs: { d: 'm4.75 10 2.25-2.5 1.75 1.75 1.25-1.25 2 2' } },
      { tag: 'path', attrs: { d: 'M9.75 6.25h.01' } }
    ]);
  };

  private readonly resolveFileBadgeLabel = (label: string): string => {
    const match = /\.([a-z0-9]+)$/i.exec(label.trim());
    return match?.[1]?.slice(0, 4).toUpperCase() || 'IMG';
  };

  private readonly createSvgIcon = (
    children: Array<{ tag: 'path'; attrs: Record<string, string> }>
  ): SVGSVGElement => {
    const svg = document.createElementNS(SVG_NAMESPACE, 'svg');
    svg.setAttribute('viewBox', '0 0 16 16');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.25');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('class', 'h-3 w-3');

    for (const child of children) {
      const element = document.createElementNS(SVG_NAMESPACE, child.tag);
      for (const [key, value] of Object.entries(child.attrs)) {
        element.setAttribute(key, value);
      }
      svg.append(element);
    }

    return svg;
  };
}
