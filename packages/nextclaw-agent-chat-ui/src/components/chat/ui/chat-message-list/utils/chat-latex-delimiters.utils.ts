import type { Extension, State, Tokenizer } from "micromark-util-types";

declare module "micromark-util-types" {
  interface TokenTypeMap {
    mathText: "mathText";
    mathTextSequence: "mathTextSequence";
    mathTextData: "mathTextData";
  }
}

/** Reuse remark-math's token contract before CommonMark consumes character escapes. */
const tokenize: Tokenizer = function (effects, ok, nok) {
  let closing = 41;
  const start: State = (code) => {
    effects.enter("mathText");
    effects.enter("mathTextSequence");
    effects.consume(code);
    return opening;
  };
  const opening: State = (code) => {
    if (code !== 40 && code !== 91) return nok(code);
    closing = code === 40 ? 41 : 93;
    effects.consume(code);
    effects.exit("mathTextSequence");
    return content;
  };
  const close: Tokenizer = (closeEffects, yes, no) => {
    const slash: State = (code) => {
      closeEffects.enter("mathTextSequence");
      closeEffects.consume(code);
      return end;
    };
    const end: State = (code) => {
      if (code !== closing) return no(code);
      closeEffects.consume(code);
      closeEffects.exit("mathTextSequence");
      return yes;
    };
    return slash;
  };
  const done: State = (code) => { effects.exit("mathText"); return ok(code); };
  const content: State = (code) => {
    if (code === null) return nok(code);
    if (code === 92) return effects.attempt({ tokenize: close }, done, escaped)(code);
    effects.enter("mathTextData");
    effects.consume(code);
    effects.exit("mathTextData");
    return content;
  };
  const escaped: State = (code) => {
    effects.enter("mathTextData");
    effects.consume(code);
    return escapedCharacter;
  };
  const escapedCharacter: State = (code) => {
    if (code === null) return nok(code);
    effects.consume(code);
    effects.exit("mathTextData");
    return content;
  };
  return start;
};

type MathNode = {
  type: string;
  position?: { start: { offset?: number } };
  data?: { hProperties?: { className?: string[] } };
  children?: MathNode[];
};

export function createRemarkLatexDelimitersPlugin(source: string) {
  return function (this: { data(): object }) {
    const data = this.data() as { micromarkExtensions?: Extension[] };
    (data.micromarkExtensions ??= []).push({ text: { 92: { tokenize } } });
    return function transform(node: MathNode): void {
      const offset = node.position?.start.offset;
      if (node.type === "inlineMath" && offset !== undefined && source.startsWith("\\[", offset)) {
        // KaTeX uses this class to produce block presentation inside the paragraph.
        if (node.data?.hProperties) node.data.hProperties.className = ["language-math", "math-display"];
      }
      node.children?.forEach(transform);
    };
  };
}
