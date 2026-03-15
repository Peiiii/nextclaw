import type { NcpMessage } from "@nextclaw/ncp";
import { MessagePart } from "./message-part";

export function MessageBubble({ message }: { message: NcpMessage }) {
  return (
    <article className={`message ${message.role}`}>
      <div className="meta">
        <span>{message.role}</span>
        <span>{message.status}</span>
      </div>
      <div className="parts">
        {message.parts.map((part, index) => (
          <MessagePart key={`${message.id}-${index}`} part={part} />
        ))}
      </div>
    </article>
  );
}
