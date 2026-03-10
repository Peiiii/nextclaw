import type { UIMessage } from '../types/ui-message.js';

export function extractTextFromMessage(message: UIMessage): string {
  const textParts: string[] = [];

  for (const part of message.parts) {
    if (part.type === 'text') {
      textParts.push(part.text);
    }
  }

  return textParts.join('\n\n');
}

export function hasCopyableText(message: UIMessage): boolean {
  return message.parts.some((part) => part.type === 'text' && part.text.trim().length > 0);
}

export function getMessagePreview(message: UIMessage, maxLength: number = 100): string {
  const text = extractTextFromMessage(message);
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength) + '...';
}
