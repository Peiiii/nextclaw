# Tools

Tools let the agent do more than answer questions. They let it perform actions.

## Two Tool Categories

### 1) Information Retrieval

- web search
- web fetch and summarization

Best for: research, comparison, and source-based summaries.

### 2) Action Execution

- file read/write/edit
- command execution (`exec`)
- messaging and scheduled tasks

Best for: repetitive workflows and operational automation.

## Beginner Recommendation

1. Enable information tools first.
2. Add action tools after your basic flow is stable.
3. For `exec`, start with the narrowest permissions.

## `exec` Safety Suggestions

- set a reasonable timeout
- restrict execution to workspace when possible
- keep least privilege in production

## Advanced Entry (Optional)

For fine-grained parameters (for example `timeout`, `restrictToWorkspace`),
see [Configuration](/en/guide/configuration) and [Commands](/en/guide/commands).

If MCP is new to you, start here:

- [MCP Tutorial (No Command Line)](/en/guide/tutorials/mcp-marketplace)
