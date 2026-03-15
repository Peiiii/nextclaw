import type { NcpMessagePart } from "@nextclaw/ncp";

export function MessagePart({ part }: { part: NcpMessagePart }) {
  if (part.type === "text") {
    return <p className="part-text">{part.text}</p>;
  }
  if (part.type === "reasoning") {
    return <p className="part-reasoning">reasoning: {part.text}</p>;
  }
  if (part.type === "tool-invocation") {
    return (
      <div className="part-tool">
        <div>tool: {part.toolName}</div>
        <pre>{JSON.stringify({ args: part.args, result: part.result }, null, 2)}</pre>
      </div>
    );
  }
  return <pre className="part-raw">{JSON.stringify(part, null, 2)}</pre>;
}
