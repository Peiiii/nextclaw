import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import css from 'highlight.js/lib/languages/css';
import diff from 'highlight.js/lib/languages/diff';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import markdown from 'highlight.js/lib/languages/markdown';
import python from 'highlight.js/lib/languages/python';
import shell from 'highlight.js/lib/languages/shell';
import sql from 'highlight.js/lib/languages/sql';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';
import type { HLJSApi, LanguageFn } from 'highlight.js';

const PLAIN_TEXT_LANGUAGES = new Set([
  'text',
  'txt',
  'plain',
  'plaintext',
  'none',
  'output',
]);

const AUTO_DETECT_LANGUAGES = [
  'typescript',
  'javascript',
  'json',
  'bash',
  'shell',
  'python',
  'css',
  'xml',
  'markdown',
  'yaml',
  'sql',
  'diff',
];

const AUTO_DETECT_MIN_RELEVANCE = 4;

type RegisteredLanguage = {
  name: string;
  language: LanguageFn;
  aliases?: string[];
};

const REGISTERED_LANGUAGES: RegisteredLanguage[] = [
  { name: 'typescript', language: typescript, aliases: ['ts', 'tsx'] },
  { name: 'javascript', language: javascript, aliases: ['js', 'jsx', 'mjs', 'cjs'] },
  { name: 'json', language: json, aliases: ['jsonc'] },
  { name: 'bash', language: bash, aliases: ['sh', 'zsh'] },
  { name: 'shell', language: shell, aliases: ['console', 'terminal'] },
  { name: 'python', language: python, aliases: ['py'] },
  { name: 'css', language: css },
  { name: 'xml', language: xml, aliases: ['html', 'svg'] },
  { name: 'markdown', language: markdown, aliases: ['md', 'mdx'] },
  { name: 'yaml', language: yaml, aliases: ['yml'] },
  { name: 'sql', language: sql },
  { name: 'diff', language: diff, aliases: ['patch'] },
];

export type ChatCodeHighlightResult = {
  html: string;
  language: string;
  highlighted: boolean;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeLanguage(value: string): string {
  return value.trim().toLowerCase();
}

export class ChatCodeSyntaxHighlighter {
  private readonly engine: HLJSApi;

  constructor() {
    this.engine = hljs.newInstance();
    REGISTERED_LANGUAGES.forEach((entry) => {
      this.engine.registerLanguage(entry.name, entry.language);
      if (entry.aliases) {
        this.engine.registerAliases(entry.aliases, { languageName: entry.name });
      }
    });
  }

  highlight = (code: string, language: string): ChatCodeHighlightResult => {
    const normalizedLanguage = normalizeLanguage(language);
    if (!code || PLAIN_TEXT_LANGUAGES.has(normalizedLanguage)) {
      return this.createPlainTextResult(code, normalizedLanguage || 'text');
    }

    if (this.engine.getLanguage(normalizedLanguage)) {
      const result = this.engine.highlight(code, {
        language: normalizedLanguage,
        ignoreIllegals: true,
      });
      return {
        html: result.value,
        language: result.language ?? normalizedLanguage,
        highlighted: true,
      };
    }

    const autoDetected = this.engine.highlightAuto(code, AUTO_DETECT_LANGUAGES);
    if (autoDetected.language && autoDetected.relevance >= AUTO_DETECT_MIN_RELEVANCE) {
      return {
        html: autoDetected.value,
        language: autoDetected.language,
        highlighted: true,
      };
    }

    return this.createPlainTextResult(code, normalizedLanguage || 'text');
  };

  private createPlainTextResult = (code: string, language: string): ChatCodeHighlightResult => ({
    html: escapeHtml(code),
    language,
    highlighted: false,
  });
}

export const chatCodeSyntaxHighlighter = new ChatCodeSyntaxHighlighter();
