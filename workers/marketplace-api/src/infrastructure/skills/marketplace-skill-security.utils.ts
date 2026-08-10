export type MarketplaceSkillSecurityVerdict = "safe" | "manual-review" | "blocked";

export type MarketplaceSkillSecurityFinding = {
  code: string;
  verdict: Exclude<MarketplaceSkillSecurityVerdict, "safe">;
  filePath: string;
};

export type MarketplaceSkillSecurityScan = {
  verdict: MarketplaceSkillSecurityVerdict;
  findings: MarketplaceSkillSecurityFinding[];
};

type MarketplaceSkillEncodedFile = {
  path: string;
  contentBase64: string;
};

type MarketplaceSkillDecodedFile = {
  path: string;
  bytes: Uint8Array;
};

type MarketplaceSkillSecurityRule = {
  code: string;
  verdict: Exclude<MarketplaceSkillSecurityVerdict, "safe">;
  pattern: RegExp;
};

const SECURITY_POLICY_VERSION = "2026-08-11.1";
const MAX_EMBEDDED_BASE64_LENGTH = 16_384;
const MAX_RECURSIVE_SCAN_DEPTH = 2;
const TEXT_FILE_PATTERN = /(?:^|\/)(?:[^/]+\.(?:bash|cjs|conf|css|env|html|ini|js|json|jsx|md|mjs|ps1|py|sh|text|toml|ts|tsx|txt|xml|yaml|yml|zsh)|dockerfile|makefile)$/i;
const EMBEDDED_BASE64_PATTERN = /\b[A-Za-z0-9+/]{48,}={0,2}\b/g;

const BLOCKED_RULES: MarketplaceSkillSecurityRule[] = [
  {
    code: "known-malware-openclaw-provider",
    verdict: "blocked",
    pattern: /openclawprovider|syazema\/openclawprovider/i
  },
  {
    code: "known-malware-network-indicator",
    verdict: "blocked",
    pattern: /91\.92\.242\.30/i
  },
  {
    code: "obfuscated-shell-execution",
    verdict: "blocked",
    pattern: /base64\s+(?:-d|--decode)[^\n|]{0,160}\|\s*(?:sudo\s+)?(?:\/bin\/)?(?:ba|z|fi|k)?sh\b/i
  },
  {
    code: "remote-command-substitution",
    verdict: "blocked",
    pattern: /(?:ba|z|fi|k)?sh\s+-c\s+["']?\$\(\s*(?:curl|wget)\b/i
  }
];

const MANUAL_REVIEW_RULES: MarketplaceSkillSecurityRule[] = [
  {
    code: "remote-download-piped-to-shell",
    verdict: "manual-review",
    pattern: /(?:curl|wget)\b[^\n|]{0,600}\|\s*(?:sudo\s+)?(?:\/bin\/)?(?:ba|z|fi|k)?sh\b/i
  },
  {
    code: "powershell-download-and-execute",
    verdict: "manual-review",
    pattern: /(?:invoke-webrequest|\biwr\b|downloadstring|system\.net\.webclient)[\s\S]{0,800}(?:invoke-expression|\biex\b|start-process)/i
  }
];

export function scanEncodedMarketplaceSkillFiles(
  files: MarketplaceSkillEncodedFile[],
  decodeBase64: (raw: string, path: string) => Uint8Array
): MarketplaceSkillSecurityScan {
  return scanDecodedMarketplaceSkillFiles(files.map((file) => ({
    path: file.path,
    bytes: decodeBase64(file.contentBase64, `files.${file.path}`)
  })));
}

export function scanDecodedMarketplaceSkillFiles(
  files: MarketplaceSkillDecodedFile[]
): MarketplaceSkillSecurityScan {
  const findings = files.flatMap((file) => scanDecodedFile(file));
  const deduped = [...new Map(findings.map((finding) => [
    `${finding.filePath}:${finding.code}`,
    finding
  ])).values()];
  const verdict: MarketplaceSkillSecurityVerdict = deduped.some((finding) => finding.verdict === "blocked")
    ? "blocked"
    : deduped.length > 0
      ? "manual-review"
      : "safe";

  return {
    verdict,
    findings: deduped
  };
}

export function formatMarketplaceSkillSecurityReviewNote(scan: MarketplaceSkillSecurityScan): string {
  const findingCodes = [...new Set(scan.findings.map((finding) => finding.code))].sort();
  return `Security review required by policy ${SECURITY_POLICY_VERSION}: ${findingCodes.join(", ")}`;
}

function scanDecodedFile(file: MarketplaceSkillDecodedFile): MarketplaceSkillSecurityFinding[] {
  if (!TEXT_FILE_PATTERN.test(file.path)) {
    return [];
  }
  const content = decodePlausibleText(file.bytes);
  if (content === null) {
    return [];
  }
  return scanText(file.path, content, 0);
}

function scanText(filePath: string, content: string, depth: number): MarketplaceSkillSecurityFinding[] {
  const findings = [...BLOCKED_RULES, ...MANUAL_REVIEW_RULES]
    .filter((rule) => rule.pattern.test(content))
    .map((rule) => ({
      code: rule.code,
      verdict: rule.verdict,
      filePath
    }));

  if (depth >= MAX_RECURSIVE_SCAN_DEPTH) {
    return findings;
  }

  for (const candidate of content.match(EMBEDDED_BASE64_PATTERN) ?? []) {
    if (candidate.length > MAX_EMBEDDED_BASE64_LENGTH) {
      continue;
    }
    const decoded = decodeEmbeddedBase64(candidate);
    if (decoded !== null) {
      findings.push(...scanText(filePath, decoded, depth + 1));
    }
  }
  return findings;
}

function decodeEmbeddedBase64(raw: string): string | null {
  try {
    const normalized = raw.padEnd(Math.ceil(raw.length / 4) * 4, "=");
    const decoded = Uint8Array.from(atob(normalized), (character) => character.charCodeAt(0));
    return decodePlausibleText(decoded);
  } catch {
    return null;
  }
}

function decodePlausibleText(bytes: Uint8Array): string | null {
  if (bytes.byteLength === 0) {
    return "";
  }
  let controlBytes = 0;
  for (const byte of bytes) {
    if (byte === 0) {
      return null;
    }
    if (byte < 9 || (byte > 13 && byte < 32)) {
      controlBytes += 1;
    }
  }
  if (controlBytes / bytes.byteLength > 0.02) {
    return null;
  }
  const decoded = new TextDecoder().decode(bytes);
  const replacementCharacters = decoded.match(/\uFFFD/g)?.length ?? 0;
  return replacementCharacters / Math.max(decoded.length, 1) > 0.01 ? null : decoded;
}
