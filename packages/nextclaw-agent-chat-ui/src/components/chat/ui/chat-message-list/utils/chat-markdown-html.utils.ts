import { defaultSchema } from "rehype-sanitize";

/** Sanitize before KaTeX; retain only the data consumed by our Markdown components. */
export const chatMarkdownHtmlSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    div: [...(defaultSchema.attributes?.div ?? []), "dataFrontmatter"],
    span: [...(defaultSchema.attributes?.span ?? []),
      ...["Kind", "Key", "Ref", "Name", "Source", "Path", "Label", "RawText", "Excerpt", "MessageId", "Role", "StartLine", "EndLine"]
        .map(suffix => `dataChatInlineToken${suffix}`),
    ],
    code: [["className", /^language-./, "math-inline", "math-display"]],
    details: ["open"],
  },
  protocols: {
    ...defaultSchema.protocols,
    href: [...(defaultSchema.protocols?.href ?? []), "nextclaw", "file"],
  },
};
