/**
 * Desensitization (redaction) primitives for NextClaw.
 *
 * Provides a rule-based text redaction engine with a built-in set of common
 * sensitive patterns (ID card, phone, email, bank card, IP, etc.) plus support
 * for user-defined keyword rules. The engine is deliberately pure and
 * side-effect free so it can run on both client and server, and can later be
 * wired into the message pipeline.
 */

export type RedactionRuleKind = 'regex' | 'keyword';

export type RedactionRule = {
  /** Stable identifier, e.g. "phone", "id-card", "custom:my-word". */
  readonly id: string;
  readonly kind: RedactionRuleKind;
  /** Human-readable label key (i18n) or raw label for custom rules. */
  readonly label: string;
  /** For regex rules: the source pattern (applied with the `flags` below). */
  readonly pattern?: string;
  readonly flags?: string;
  /** For keyword rules: literal text to match (case-insensitive). */
  readonly keyword?: string;
  /** When true the rule is only active if the user explicitly enables it. */
  readonly optional?: boolean;
};

export const REDACTED_PLACEHOLDER = '[REDACTED]';

/**
 * Built-in sensitive patterns, on by default. All patterns are anchored to
 * word boundaries where sensible to avoid over-redaction inside normal prose.
 */
export const DEFAULT_REDACTION_RULES: readonly RedactionRule[] = [
  {
    id: 'phone',
    kind: 'regex',
    label: 'redactionRulePhone',
    pattern: '\\b1[3-9]\\d{9}\\b',
    flags: 'g',
  },
  {
    id: 'id-card',
    kind: 'regex',
    label: 'redactionRuleIdCard',
    pattern: '\\b[1-9]\\d{5}(?:19|20)\\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\\d|3[01])\\d{3}[0-9Xx]\\b',
    flags: 'g',
  },
  {
    id: 'email',
    kind: 'regex',
    label: 'redactionRuleEmail',
    pattern: '\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}\\b',
    flags: 'g',
  },
  {
    id: 'bank-card',
    kind: 'regex',
    label: 'redactionRuleBankCard',
    pattern: '\\b\\d{16,19}\\b',
    flags: 'g',
  },
  {
    id: 'ipv4',
    kind: 'regex',
    label: 'redactionRuleIpv4',
    pattern: '\\b(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(?:\\.(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3}\\b',
    flags: 'g',
  },
];

/** Default rule ids that are enabled out of the box. */
export const DEFAULT_ENABLED_RULE_IDS: readonly string[] =
  DEFAULT_REDACTION_RULES.map((rule) => rule.id);

export function isRuleActive(
  rule: RedactionRule,
  enabledRuleIds: ReadonlySet<string>,
): boolean {
  if (rule.optional) {
    return enabledRuleIds.has(rule.id);
  }
  return true;
}

function buildRuleMatcher(
  rule: RedactionRule,
): { test: (input: string) => boolean; replace: (input: string) => string } | null {
  if (rule.kind === 'regex' && rule.pattern) {
    let expression: RegExp;
    try {
      expression = new RegExp(rule.pattern, rule.flags ?? 'g');
    } catch {
      return null;
    }
    return {
      test: (input) => expression.test(input),
      replace: (input) => input.replace(expression, REDACTED_PLACEHOLDER),
    };
  }

  if (rule.kind === 'keyword' && rule.keyword) {
    const escaped = rule.keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let expression: RegExp;
    try {
      expression = new RegExp(escaped, 'gi');
    } catch {
      return null;
    }
    return {
      test: (input) => expression.test(input),
      replace: (input) => input.replace(expression, REDACTED_PLACEHOLDER),
    };
  }

  return null;
}

export type RedactResult = {
  /** The redacted text (unchanged when nothing matched). */
  text: string;
  /** Rule ids that produced at least one replacement. */
  matchedRuleIds: string[];
};

/**
 * Apply the active rules to `input`. Rules are applied in the order given;
 * a later rule never re-processes text already replaced by an earlier rule.
 */
export function redactText(
  input: string,
  rules: readonly RedactionRule[],
  enabledRuleIds: ReadonlySet<string> = new Set(),
): RedactResult {
  if (!input) {
    return { text: input, matchedRuleIds: [] };
  }

  let text = input;
  const matchedRuleIds: string[] = [];

  for (const rule of rules) {
    if (!isRuleActive(rule, enabledRuleIds)) {
      continue;
    }
    const matcher = buildRuleMatcher(rule);
    if (!matcher) {
      continue;
    }
    if (!matcher.test(text)) {
      continue;
    }
    text = matcher.replace(text);
    matchedRuleIds.push(rule.id);
  }

  return { text, matchedRuleIds };
}

/** Convenience: redact with the built-in defaults plus user rules. */
export function redactWithDefaults(
  input: string,
  customRules: readonly RedactionRule[] = [],
  enabledRuleIds: ReadonlySet<string> = new Set(DEFAULT_ENABLED_RULE_IDS),
): RedactResult {
  return redactText(input, [...DEFAULT_REDACTION_RULES, ...customRules], enabledRuleIds);
}
