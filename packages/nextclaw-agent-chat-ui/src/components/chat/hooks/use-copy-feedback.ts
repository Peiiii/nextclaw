import { useCallback, useEffect, useState } from 'react';
import { copyText } from '@agent-chat-ui/components/chat/utils/copy-text.utils';

type UseCopyFeedbackParams = {
  text: string;
  resetDelayMs?: number;
};

type UseCopyFeedbackResult = {
  copied: boolean;
  copy: () => Promise<void>;
};

const DEFAULT_RESET_DELAY_MS = 1300;

export function useCopyFeedback(params: UseCopyFeedbackParams): UseCopyFeedbackResult {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    if (!params.text) {
      return;
    }

    const didCopy = await copyText(params.text);
    if (didCopy) {
      setCopied(true);
    } else {
      setCopied(false);
    }
  }, [params.text]);

  useEffect(() => {
    if (!copied || typeof window === 'undefined') {
      return;
    }

    const timer = window.setTimeout(() => setCopied(false), params.resetDelayMs ?? DEFAULT_RESET_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [copied, params.resetDelayMs]);

  return {
    copied,
    copy
  };
}
