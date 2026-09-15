---
"@nextclaw/agent-chat-ui": patch
"@nextclaw/kernel": patch
"@nextclaw/ui": patch
---

Reduce Markdown document properties spacing and text size so front matter leaves more room for document content.

Animate document properties expansion and collapse using the shared interruptible transition, with reduced-motion support.

Support animated GitHub-style details/summary sections in chat and Markdown file previews, including nested sections and initial open state. Briefly document this capability in the agent reply-format prompt.

Tell agents that Markdown supports inline and block LaTeX formulas without expanding the reply-format prompt budget.
