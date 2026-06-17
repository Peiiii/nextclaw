function canUseClipboardApi(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.clipboard?.writeText === 'function'
  );
}

function restoreSelection(ranges: Range[]) {
  if (typeof document === 'undefined') {
    return;
  }

  const selection = document.getSelection();
  if (!selection) {
    return;
  }

  selection.removeAllRanges();
  ranges.forEach((range) => selection.addRange(range));
}

type CopyContextSnapshot = {
  activeElement: HTMLElement | null;
  activeInputSelection: {
    input: HTMLInputElement | HTMLTextAreaElement;
    start: number | null;
    end: number | null;
  } | null;
  ranges: Range[];
};

function snapshotCopyContext(): CopyContextSnapshot {
  const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const activeInput = activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement
    ? activeElement
    : null;
  const activeInputSelection = activeInput
    ? {
        input: activeInput,
        start: activeInput.selectionStart,
        end: activeInput.selectionEnd
      }
    : null;
  const selection = document.getSelection();
  const ranges = selection
    ? Array.from({ length: selection.rangeCount }, (_, index) => selection.getRangeAt(index).cloneRange())
    : [];
  return { activeElement, activeInputSelection, ranges };
}

function createCopyTextarea(text: string): HTMLTextAreaElement {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.setAttribute('aria-hidden', 'true');
  Object.assign(textarea.style, {
    fontSize: '12pt',
    left: '-9999px',
    opacity: '0',
    pointerEvents: 'none',
    position: 'fixed',
    top: '0'
  });
  return textarea;
}

function focusWithoutScroll(element: HTMLElement) {
  try {
    element.focus({ preventScroll: true });
  } catch {
    element.focus();
  }
}

function selectTextarea(textarea: HTMLTextAreaElement) {
  focusWithoutScroll(textarea);
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);
}

function runCopyCommand(): boolean {
  try {
    return typeof document.execCommand === 'function' && document.execCommand('copy');
  } catch {
    return false;
  }
}

function restoreInputSelection(snapshot: CopyContextSnapshot): boolean {
  if (!snapshot.activeInputSelection) {
    return false;
  }

  const { input, start, end } = snapshot.activeInputSelection;
  if (start === null || end === null) {
    return false;
  }
  input.setSelectionRange(start, end);
  return true;
}

function restoreCopyContext(snapshot: CopyContextSnapshot) {
  if (snapshot.activeElement) {
    focusWithoutScroll(snapshot.activeElement);
  }
  if (!restoreInputSelection(snapshot)) {
    restoreSelection(snapshot.ranges);
  }
}

function fallbackCopyText(text: string): boolean {
  if (typeof document === 'undefined' || !document.body) {
    return false;
  }

  const snapshot = snapshotCopyContext();
  const textarea = createCopyTextarea(text);
  document.body.appendChild(textarea);
  selectTextarea(textarea);
  const copied = runCopyCommand();
  textarea.remove();
  restoreCopyContext(snapshot);
  return copied;
}

export async function copyText(text: string): Promise<boolean> {
  if (!text) {
    return false;
  }

  if (canUseClipboardApi()) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return fallbackCopyText(text);
    }
  }

  return fallbackCopyText(text);
}
