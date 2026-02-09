import type { ChatMessage } from "../lib/types";

interface Props {
  message: ChatMessage;
}

export function MessageBubble({ message }: Props) {
  const isUser = message.role === "user";

  return (
    <div class={`hcw-message ${isUser ? "hcw-message--user" : "hcw-message--assistant"}`}>
      <div class={`hcw-bubble ${isUser ? "hcw-bubble--user" : "hcw-bubble--assistant"}`}>
        <p>{message.content}</p>
        {message.citations && message.citations.length > 0 && (
          <div class="hcw-citations">
            {message.citations.map((c) => (
              <span key={c.chunk_id} class="hcw-citation-tag">
                {c.title}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
