const ANSI_ESCAPE_PREFIX = String.fromCharCode(27);
const ANSI_PATTERN = new RegExp(`${ANSI_ESCAPE_PREFIX}\\[(.*?)([ -/]*[@-~])`, "g");

export function hasAnsiSequences(value: string): boolean {
  return value.includes(`${ANSI_ESCAPE_PREFIX}[`);
}

export function stripAnsiSequences(value: string): string {
  return value.replace(new RegExp(`${ANSI_ESCAPE_PREFIX}\\[[0-?]*[ -/]*[@-~]`, "g"), "");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type AnsiStyle = {
  bold: boolean;
  dim: boolean;
  italic: boolean;
  underline: boolean;
  inverse: boolean;
  fg?: string;
  bg?: string;
};

const DEFAULT_STYLE: AnsiStyle = {
  bold: false,
  dim: false,
  italic: false,
  underline: false,
  inverse: false,
};

const SGR_STYLE_PATCHES: Record<number, Partial<AnsiStyle>> = {
  1: { bold: true },
  2: { dim: true },
  3: { italic: true },
  4: { underline: true },
  7: { inverse: true },
  22: { bold: false, dim: false },
  23: { italic: false },
  24: { underline: false },
  27: { inverse: false },
  39: { fg: undefined },
  49: { bg: undefined },
};

const BASIC_FG: Record<number, string> = {
  30: "black",
  31: "red",
  32: "green",
  33: "yellow",
  34: "blue",
  35: "magenta",
  36: "cyan",
  37: "white",
  90: "bright-black",
  91: "bright-red",
  92: "bright-green",
  93: "bright-yellow",
  94: "bright-blue",
  95: "bright-magenta",
  96: "bright-cyan",
  97: "bright-white",
};

const BASIC_BG: Record<number, string> = {
  40: "black",
  41: "red",
  42: "green",
  43: "yellow",
  44: "blue",
  45: "magenta",
  46: "cyan",
  47: "white",
  100: "bright-black",
  101: "bright-red",
  102: "bright-green",
  103: "bright-yellow",
  104: "bright-blue",
  105: "bright-magenta",
  106: "bright-cyan",
  107: "bright-white",
};

function resolveExtendedColor(
  params: number[],
  index: number,
): { color: string; consumed: number } | null {
  const mode = params[index + 1];
  if (mode === 5 && typeof params[index + 2] === "number") {
    return { color: `ansi-256-${params[index + 2]}`, consumed: 2 };
  }
  if (
    mode === 2 &&
    typeof params[index + 2] === "number" &&
    typeof params[index + 3] === "number" &&
    typeof params[index + 4] === "number"
  ) {
    return {
      color: `rgb(${params[index + 2]},${params[index + 3]},${params[index + 4]})`,
      consumed: 4,
    };
  }
  return null;
}

function applySgr(style: AnsiStyle, params: number[]): AnsiStyle {
  let next = { ...style };
  for (let index = 0; index < params.length; index += 1) {
    const code = params[index]!;
    if (code === 0) {
      return { ...DEFAULT_STYLE };
    }
    const stylePatch = SGR_STYLE_PATCHES[code];
    if (stylePatch) {
      next = { ...next, ...stylePatch };
      continue;
    }
    if (code === 38 || code === 48) {
      const extendedColor = resolveExtendedColor(params, index);
      if (extendedColor) {
        next =
          code === 38
            ? { ...next, fg: extendedColor.color }
            : { ...next, bg: extendedColor.color };
        index += extendedColor.consumed;
      }
      continue;
    }
    if (BASIC_FG[code]) {
      next = { ...next, fg: BASIC_FG[code] };
      continue;
    }
    if (BASIC_BG[code]) {
      next = { ...next, bg: BASIC_BG[code] };
    }
  }
  return next;
}

function styleToClassName(style: AnsiStyle): string {
  const classes: string[] = ["ansi"];
  if (style.bold) classes.push("ansi-bold");
  if (style.dim) classes.push("ansi-dim");
  if (style.italic) classes.push("ansi-italic");
  if (style.underline) classes.push("ansi-underline");
  if (style.inverse) classes.push("ansi-inverse");
  if (style.fg) {
    if (style.fg.startsWith("rgb(")) {
      classes.push("ansi-fg-custom");
    } else if (style.fg.startsWith("ansi-256-")) {
      classes.push("ansi-fg-256");
      classes.push(style.fg);
    } else {
      classes.push(`ansi-fg-${style.fg}`);
    }
  }
  if (style.bg) {
    if (style.bg.startsWith("rgb(")) {
      classes.push("ansi-bg-custom");
    } else if (style.bg.startsWith("ansi-256-")) {
      classes.push("ansi-bg-256");
      classes.push(style.bg);
    } else {
      classes.push(`ansi-bg-${style.bg}`);
    }
  }
  return classes.join(" ");
}

function styleToInlineStyle(style: AnsiStyle): string | undefined {
  const parts: string[] = [];
  if (style.fg?.startsWith("rgb(")) {
    parts.push(`color:${style.fg}`);
  }
  if (style.bg?.startsWith("rgb(")) {
    parts.push(`background-color:${style.bg}`);
  }
  return parts.length > 0 ? parts.join(";") : undefined;
}

function openSpan(style: AnsiStyle): string {
  const className = styleToClassName(style);
  const inline = styleToInlineStyle(style);
  return inline
    ? `<span class="${className}" style="${inline}">`
    : `<span class="${className}">`;
}

/**
 * Lightweight ANSI SGR -> HTML converter for terminal output.
 * Handles common color/style codes without adding a dependency.
 */
export function ansiToHtml(value: string): string {
  if (!value) {
    return "";
  }
  if (!hasAnsiSequences(value)) {
    return escapeHtml(value);
  }

  let html = "";
  let lastIndex = 0;
  let style = { ...DEFAULT_STYLE };
  let spanOpen = false;

  const flushText = (text: string) => {
    if (!text) return;
    if (!spanOpen) {
      html += openSpan(style);
      spanOpen = true;
    }
    html += escapeHtml(text);
  };

  const closeSpan = () => {
    if (spanOpen) {
      html += "</span>";
      spanOpen = false;
    }
  };

  value.replace(ANSI_PATTERN, (match, body: string, terminator: string, offset: number) => {
    flushText(value.slice(lastIndex, offset));
    lastIndex = offset + match.length;

    // Only handle SGR (`m`). Other CSI sequences are dropped.
    if (terminator !== "m") {
      return match;
    }

    const params =
      body.trim().length === 0
        ? [0]
        : body
            .split(";")
            .map((part) => Number.parseInt(part, 10))
            .filter((part) => Number.isFinite(part));

    closeSpan();
    style = applySgr(style, params.length > 0 ? params : [0]);
    return match;
  });

  flushText(value.slice(lastIndex));
  closeSpan();
  return html;
}
